# VerifyPay: address-poisoning interceptor and self-freezing USDC settlement on Arc

Payments to verified businesses settle instantly. Payments to look-alike (poisoned) or first-time
addresses go into a 10-minute undo escrow. A Chainlink CRE workflow verifies each business's domain
and re-checks it daily, freezing the payee the moment its DNS proof disappears.

Bounties: **Arc: Best Smart Contracts with Advanced Stablecoin Logic** · **Chainlink: Best workflow with CRE** · **World: World ID Agent Pass**

Specs: `/specs` · Prompts: `/prompts` · AI disclosure: `AI_USAGE.md`

## What's in the repo
| Folder | What |
|---|---|
| `src/`, `test/` | Contracts + 45 Foundry tests (unit, fuzz, invariant, EIP-712 compatibility with the backend) |
| `cre/` | Chainlink CRE workflow: verify on registration, daily re-check, auto-freeze |
| `server/` | Backend: World ID Agent Pass + validation, approval signer, poisoning history scan (12 tests) |
| `web/` | Web app (no build step): Pay, Undo window, History shield, Business, Agent wallet |
| `agent/` | An AI agent paying a verified business by domain |
| `specs/`, `prompts/` | Spec suite and prompts (ETHGlobal spec-driven rule) |

**Building in Arc Studio:** follow [ARC_STUDIO_BUILD.md](ARC_STUDIO_BUILD.md). Studio project URL: _add after step 1_

## Sponsor docs
- Qualification checklist: [SPONSOR_QUALIFICATION.md](SPONSOR_QUALIFICATION.md)
- Arc Studio build: [ARC_STUDIO_BUILD.md](ARC_STUDIO_BUILD.md)
- Chainlink CRE: [cre/README.md](cre/README.md) · [feedback](docs/chainlink-cre-feedback.md)
- World Agent Pass: [docs/world-integration.md](docs/world-integration.md) · [debrief](docs/world-debrief.md)

## Run locally
```
forge test
cd server && cp .env.example .env   # fill addresses, signer key, World client id
npm i && npm test && npm start      # http://localhost:8787
```

## Contracts (`src/`)
| Contract | Key functions |
|---|---|
| `PayeeRegistry` | `requestRegistration(domain)`, `onReport(metadata, report)` (CRE only), `requestPayoutChange` / `executePayoutChange` / `cancelPayoutChange`, `executeControllerChange` / `cancelControllerChange`, views `resolve`, `resolveName`, `inspectRecipient`, `fingerprint`, `domainCount`, `domainAt` |
| `SafeSend` | `payByName(token, domainHash, amount, ref)`, `send(token, to, amount, ref)`, `cancel(id)`, `release(id)`; USDC + EURC |
| `AgentWallet` | `agentPay(token, domainHash, amount, ref)` (agent, verified payees only, caps), `raiseLimits` (needs World ID approval), `lowerLimits`, `setPaused`, `withdraw` |

CRE report: `abi.encode(bytes32 domainHash, address controller, bytes32 leiHash, uint8 action)`, action 1 = verify, 2 = freeze.

## Arc Testnet constants
- Chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`, faucet `https://faucet.circle.com`
- USDC ERC-20 interface `0x3600000000000000000000000000000000000000` (6 decimals; native gas balance uses 18, never mix with `msg.value`)
- CRE chain name `arc-testnet`; MockKeystoneForwarder (simulation) `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`; production KeystoneForwarder `0x76c9cf548b4179F8901cda1f8623568b58215E62`

## Test
```
forge test   # 45 tests: unit, fuzz, invariant (escrow always fully backed), EIP-712 compatibility
```

## Deploy
```
APPROVAL_SIGNER=0x... forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast --private-key $PK
```

## CRE workflow (`cre/`)
Full guide: [cre/README.md](cre/README.md) · Feedback: [docs/chainlink-cre-feedback.md](docs/chainlink-cre-feedback.md)

1. Business publishes TXT `_verifypay.<domain>` = `arc:<controller address>` (optional second TXT `lei:<20-char LEI>`).
2. `cd cre && cre generate-bindings evm` (reads `contracts/evm/src/abi/PayeeRegistry.abi`).
3. Put the registry address in `verifypay-workflow/config.staging.json`, fund `CRE_ETH_PRIVATE_KEY` in `.env` with Arc testnet USDC.
4. Call `requestRegistration("acme.com")`, then:
```
cre workflow simulate verifypay-workflow --target staging-settings --broadcast \
  --non-interactive --trigger-index 0 --evm-tx-hash <requestRegistration tx> --evm-event-index 0
```
Trigger 1 (cron) re-checks every payee: delete the TXT record and run it to freeze the payee live.

## Security notes
- `onReport` accepts only the Forwarder; set `expectedAuthor` (workflow owner) for production.
- A DNS change to a new key never takes effect instantly: the payee freezes and the new key waits `changeDelay`; the current controller can cancel.
- Payout changes need the controller plus an EIP-712 approval the backend signs only after a validated World Agent Pass, then `changeDelay`; the current payout wallet can cancel.
- A wallet whose first-4/last-4 hex fingerprint collides with a registered payout can never be registered or rotated in.
- Out of scope: an attacker controlling DNS **and** the owner's World ID **and** going unnoticed for the full delay.

## License
MIT
