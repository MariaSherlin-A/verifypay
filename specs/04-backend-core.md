# 04 · Backend core

## Contracts (already implemented in /src, 45 tests passing)

### PayeeRegistry
- `constructor(address forwarder, address expectedAuthor, address approvalSigner, uint64 changeDelay)`
- `requestRegistration(string domain) returns (bytes32)`
- `onReport(bytes metadata, bytes report)`: report = `abi.encode(bytes32 domainHash, address controller, bytes32 leiHash, uint8 action)`; action 1 VERIFY, 2 FREEZE
- `requestPayoutChange(bytes32 d, address newPayout, uint256 deadline, bytes sig)`; EIP-712 `PayoutChange(bytes32 domainHash,address newPayout,uint256 nonce,uint256 deadline)`, domain `{name:"VerifyPay", version:"1", chainId, verifyingContract}`
- `executePayoutChange(bytes32)`, `cancelPayoutChange(bytes32)`, `executeControllerChange(bytes32)`, `cancelControllerChange(bytes32)`
- Views: `resolve`, `resolveName`, `getPayee`, `inspectRecipient`, `fingerprint`, `domainCount`, `domainAt`, `nonces`, `payoutToDomain`, `fingerprintOwner`
- Events: `RegistrationRequested, PayeeVerified, PayeeFrozen, VerificationRejected, ControllerChangeQueued, ControllerChanged, ControllerChangeCancelled, PayoutChangeQueued, PayoutChanged, PayoutChangeCancelled`
- Storage: `mapping(bytes32=>Payee)`, `payoutToDomain`, `fingerprintOwner`, `nonces`, `_domainList`

### SafeSend
- `constructor(PayeeRegistry, address[] tokens, uint64 undoWindow)` (tokens = USDC, EURC)
- `payByName(address token, bytes32, uint256, bytes32 ref)`, `send(address token, address, uint256, bytes32 ref) returns (bool escrowed, uint256 id)`, `cancel(uint256)`, `release(uint256)`, `totalEscrowed(token)`
- Events: `Paid(token, sender, to, amount, domainHash, ref), Escrowed(id, token, sender, to, amount, reason, imitated, releaseAt, ref), Cancelled, Released`

### AgentWallet
- `constructor(PayeeRegistry, address owner, address agent, address approvalSigner)`
- `agentPay(address token, bytes32 domainHash, uint256 amount, bytes32 ref)` (agent), `setAgent`, `setPaused`, `lowerLimits`, `raiseLimits(token, perPayment, perDay, deadline, sig)` (owner + approval), `withdraw`, `spentToday`
- EIP-712 `RaiseLimits(address wallet,address token,uint128 perPayment,uint128 perDay,uint256 nonce,uint256 deadline)`, domain `{name:"VerifyPayAgentWallet", version:"1"}`

## CRE workflow (/cre)
- `verifypay-workflow/workflow.ts`: trigger 0 = log `RegistrationRequested`; trigger 1 = cron `schedule`.
- HTTP via `cre.capabilities.HTTPClient` + `consensusIdenticalAggregation`; writes via generated `PayeeRegistry.writeReport`.
- Bindings: `cd cre && cre generate-bindings evm` (ABI at `cre/contracts/evm/src/abi/PayeeRegistry.abi`; regenerate after any ABI change: `forge inspect src/PayeeRegistry.sol:PayeeRegistry abi --json > cre/contracts/evm/src/abi/PayeeRegistry.abi`).

## Backend API (implemented: /server, Node 22, one dependency viem)
| Route | Purpose |
|---|---|
| `GET /api/config` | addresses + chain for the web app |
| `POST /api/agent-pass/start` `{action:'payoutChange'|'raiseLimits', params}` | OIDC discovery at `${WORLD_ISSUER}/.well-known/openid-configuration`, RFC 8628 device authorization; returns user code + verification URI |
| `POST /api/agent-pass/poll` `{sessionId}` | token poll; denied/expired → no approval; on `id_token`: validate signature (JWKS), iss, aud, exp, iat, **auth_time ≥ session start** (fresh), sub binding; then sign EIP-712 with the on-chain nonce |
| `GET /api/history-scan?address=` | Blockscout v2 `/api/v2/addresses/{a}/token-transfers?type=ERC-20` → poisoning attempts |
| static | serves /web |
[ASSUMPTION] World Agent Pass exposes a device_authorization_endpoint in its discovery document (another team used the device grant). If it only offers the authorization-code flow, swap `startDeviceFlow`/`pollDeviceToken` for a redirect + code exchange; `validateIdToken` stays the same.

## Deployment
`script/Deploy.s.sol` deploys PayeeRegistry, SafeSend (USDC `0x3600…0000` + EURC `0x89B5…D72a`) and a demo AgentWallet. Forwarder (simulation) `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`.

## Env vars
| Var | Where |
|---|---|
| `PK` (deployer), `CRE_ETH_PRIVATE_KEY` | local .env only |
| `APPROVAL_SIGNER_KEY` (backend), `APPROVAL_SIGNER` (address, deploy) | backend .env |
| `WORLD_ISSUER`, `WORLD_CLIENT_ID`, `WORLD_CLIENT_SECRET`, `WORLD_SCOPE` | backend .env (see server/.env.example) |
| `AGENT_KEY`, `AGENT_WALLET_ADDRESS` | agent script |
| `REGISTRY_ADDRESS`, `SAFESEND_ADDRESS`, `AGENT_WALLET_ADDRESS`, `USDC_ADDRESS`, `EURC_ADDRESS` | backend .env (served to the web app via /api/config) |
| `CHANGE_DELAY` (120 demo), `UNDO_WINDOW` (600) | deploy |
