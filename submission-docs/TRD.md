# Technical Requirements Document: VerifyPay

| | |
|---|---|
| Version | 1.0 (ETHGlobal Mumbai submission) |
| Network | Arc Testnet (chain 5042002) |
| Related | [PRD.md](PRD.md), [03-security.md](../specs/03-security.md), [ARCHITECTURE.md](ARCHITECTURE.md) |

## 1. Technology

| Layer | Technology |
|---|---|
| Chain | Arc Testnet: USDC as gas, deterministic finality |
| Contracts | Solidity 0.8.28, Foundry (unit, fuzz and invariant tests) |
| Verification | Chainlink CRE TypeScript SDK (`@chainlink/cre-sdk`), CRE CLI |
| Human approval | World ID (OpenID Connect, device authorization flow, Orb verification) |
| Backend | Bun, viem; deployed on Railway |
| Web application | React, Vite, TypeScript, Tailwind CSS, viem, TanStack Query; built in Arc Studio, deployed on Vercel |
| Tokens | USDC `0x3600000000000000000000000000000000000000` (ERC-20 interface, 6 decimals), EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

## 2. On-chain versus off-chain

| Concern | Location | Reason |
|---|---|---|
| Business status, payout wallet, delays, escrow, fingerprints | Arc contracts | Must be enforceable and publicly readable; nobody, including the team, can bypass them |
| DNS and LEI checks | Chainlink CRE | External data, verified by consensus instead of a single server key |
| World ID validation | Backend | The OIDC flow must be validated server-side; its only output is a narrow EIP-712 approval |
| History scan and payment list | Backend and client reads | Read-only, advisory, and costly to compute on-chain |

## 3. Contract interfaces

### PayeeRegistry

| Function | Access | Effect |
|---|---|---|
| `requestRegistration(string domain)` | Anyone | Stores the domain as Pending, emits `RegistrationRequested` |
| `onReport(bytes metadata, bytes report)` | CRE forwarder only (and expected workflow owner when set) | Applies VERIFY (1) or FREEZE (2) |
| `executeControllerChange(bytes32)` / `cancelControllerChange(bytes32)` | Anyone after the delay / current controller | Completes or cancels a DNS-driven controller change |
| `requestPayoutChange(bytes32, address, uint256 deadline, bytes sig)` | Controller with backend approval | Queues a payout change behind `changeDelay` |
| `executePayoutChange(bytes32)` / `cancelPayoutChange(bytes32)` | Anyone after the delay / controller or current payout | Completes or cancels the payout change |
| `resolve`, `resolveName`, `getPayee`, `inspectRecipient`, `fingerprint`, `domainCount`, `domainAt` | View | Lookups for the application, CRE and integrators |

Report encoding: `abi.encode(bytes32 domainHash, address controller, bytes32 leiHash, uint8 action)`.

### SafeSend

| Function | Access | Effect |
|---|---|---|
| `payByName(address token, bytes32 domainHash, uint256 amount, bytes32 ref)` | Anyone | Pays an Active business directly |
| `send(address token, address to, uint256 amount, bytes32 ref)` | Anyone | Pays directly, escrows for `undoWindow`, or reverts, according to the verdict |
| `cancel(uint256 id)` | Sender, before `releaseAt` | Refunds the escrow |
| `release(uint256 id)` | Anyone, after `releaseAt` | Pays the escrow to the recipient |

### AgentWallet

| Function | Access | Effect |
|---|---|---|
| `agentPay(address token, bytes32 domainHash, uint256 amount, bytes32 ref)` | Agent | Pays an Active business within limits |
| `raiseLimits(address token, uint128 perPayment, uint128 perDay, uint256 deadline, bytes sig)` | Owner with backend approval | Raises limits |
| `lowerLimits`, `setPaused`, `withdraw` | Owner | Immediate |

### Events

| Contract | Events |
|---|---|
| PayeeRegistry | `RegistrationRequested`, `PayeeVerified`, `PayeeFrozen`, `VerificationRejected`, `ControllerChangeQueued`, `ControllerChanged`, `ControllerChangeCancelled`, `PayoutChangeQueued`, `PayoutChanged`, `PayoutChangeCancelled` |
| SafeSend | `Paid`, `Escrowed`, `Cancelled`, `Released` |
| AgentWallet | `AgentSet`, `Paused`, `LimitsSet`, `AgentPaid`, `Withdrawn` |

All failures use custom errors (for example `UnauthorizedForwarder`, `LookalikeCollision`, `TooEarly`,
`PayeeNotActive`, `OverPerPayment`), which the web application decodes and shows by name.

### EIP-712 approvals

Domain: name `VerifyPay`, version `1`, chain ID, verifying contract.

| Type | Fields |
|---|---|
| `PayoutChange` | `bytes32 domainHash, address newPayout, uint256 nonce, uint256 deadline` |
| `RaiseLimits` | `address wallet, address token, uint128 perPayment, uint128 perDay, uint256 nonce, uint256 deadline` |

Signatures with a high `s` value are rejected. Nonces are consumed on use.

## 4. CRE workflow

| Item | Value |
|---|---|
| Triggers | 0: EVM log `RegistrationRequested`; 1: cron (`0 0 * * *` in `config.staging.json`) |
| Data sources | `dns.google` and `cloudflare-dns.com` (DNS-over-HTTPS); optional `api.gleif.org` |
| Consensus | `consensusIdenticalAggregation` on every HTTP result |
| Decision | Both resolvers return `arc:<controller>` (and, when required, DNSSEC-validated) leads to VERIFY; otherwise an Active payee is frozen and a Pending or Frozen payee is left unchanged |
| Write | `writeReport` through the forwarder to `PayeeRegistry.onReport`, gas limit 500,000 |
| Chain name | `arc-testnet` |
| Simulation forwarder | `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1` |
| Production forwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` with `expectedAuthor` set to the workflow owner |

## 5. Backend

| Route | Method | Behavior |
|---|---|---|
| `/api/config` | GET | Returns chain ID, RPC, explorer, contract and token addresses, approval signer address |
| `/api/agent-pass/start` | POST | Validates the requested action, starts a World ID device authorization, returns the user code and verification link |
| `/api/agent-pass/poll` | POST | Polls the token endpoint; on approval validates the ID token, enforces the same-human binding and returns the signed approval |
| `/api/history-scan` | GET | Merges explorer token transfers with raw `Transfer` logs and returns poisoning findings |

ID-token validation: signature against the issuer's JWKS, issuer, audience and authorized party, expiry, and a freshness
check on the authentication time. Endpoints come from the issuer's discovery document.

Environment variables (values never committed): `ARC_RPC_URL`, `ARC_EXPLORER_URL`, `CHAIN_ID`, `REGISTRY_ADDRESS`,
`SAFESEND_ADDRESS`, `AGENT_WALLET_ADDRESS`, `USDC_ADDRESS`, `EURC_ADDRESS`, `APPROVAL_SIGNER_KEY`,
`APPROVAL_TTL_SECONDS`, `WORLD_ISSUER`, `WORLD_CLIENT_ID`, `WORLD_CLIENT_SECRET`, `WORLD_SCOPE`, `WORLD_CLIENT_AUTH`.

## 6. Web application

- Configuration (addresses, chain, explorer) is loaded from `/api/config`; no address is hard-coded in the client.
- Every transaction passes through one `write()` path: simulate, send through the injected wallet, wait for the receipt,
  refresh affected data. Token approvals are for the exact payment amount, never unlimited.
- Escrow and payment history are read from SafeSend events starting at its deployment block (70,933,971).
- If the wallet reports a duplicate submission ("already known"), the application locates the landed transaction by
  sender, nonce, contract and exact call data instead of reporting a failure.

## 7. Network constraints

| Constraint | Handling |
|---|---|
| The public Arc RPC limits requests per client IP | Reads use Arc's partner RPCs (Blockdaemon first, public RPC, then dRPC) with retry and pacing |
| Log queries are limited to about 10,000 blocks | All log reads are chunked to 10,000 blocks |
| The explorer omits zero-value token transfers | The history scan also reads raw `Transfer` logs |

## 8. Testing

| Suite | Scope | Command |
|---|---|---|
| Foundry, 45 tests | Unit, fuzz and invariant tests (escrow always fully backed), EIP-712 compatibility with the backend | `forge test` |
| Backend, 14 tests (`server/`) | OIDC discovery and token validation, poisoning detection | `cd server && npm test` |
| Backend, 18 tests (`studio-app/server/`) | The above plus same-human binding store | `cd studio-app && bun run test:server` |
| CRE | Type check and simulation against live DNS | `npm run typecheck`, `cre workflow simulate` |

## 9. Production changes

- Deploy the workflow to a Chainlink DON; use the KeystoneForwarder and set `expectedAuthor`.
- Require DNSSEC (`requireDnssec: true`).
- Increase `changeDelay` to 48 hours and widen fingerprints beyond 4 + 4 hex characters.
- Store World ID bindings in a database instead of a file.
- Independent security audit.
