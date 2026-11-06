# Chainlink CRE workflow: verify and auto-freeze payees

The CRE workflow is the only thing that can verify or freeze a business in VerifyPay. Many Chainlink nodes
check the business's DNS proof through two independent resolvers, must agree, and write the result to
`PayeeRegistry.onReport` on Arc Testnet. No single server key decides.

## Prize fit (Chainlink: Best workflow with CRE)
| Requirement | How we meet it |
|---|---|
| CRE workflow used as an orchestration layer | It decides whether each payee is Active or Frozen; payments depend on it |
| Integrates a blockchain with an external API / data source | Reads DNS via `dns.google` and `cloudflare-dns.com` (DNS-over-HTTPS), optional `api.gleif.org` LEI check, writes to Arc |
| Successful simulation or deployment | `cre workflow simulate ... --broadcast` sends real `onReport` transactions to Arc Testnet |
| Meaningful use | Pay-by-name, auto-freeze and the undo escrow decisions all depend on the status CRE writes |

## What it does
| Trigger | When | Action |
|---|---|---|
| 0: EVM log `RegistrationRequested(domainHash, domain, requester)` | A business calls `requestRegistration("acme.com")` | Check DNS → write VERIFY (Active) |
| 1: Cron (`schedule`, daily) | Every day | Re-check every payee → FREEZE if the proof is gone or the LEI lapsed; VERIFY if it is back |

Decision rules (`workflow.ts` → `decide`):
- Both resolvers must answer and agree on `arc:<controller address>` in TXT `_verifypay.<domain>` → **VERIFY**.
- With `requireDnssec: true`, both answers must also be DNSSEC-validated (`AD` flag).
- If a second TXT `lei:<20-char LEI>` exists, GLEIF must report `ISSUED` + `ACTIVE`.
- Otherwise, if the payee is Active → **FREEZE**; if Pending/Frozen → no write.
- A VERIFY naming a *different* controller is handled by the contract: it freezes the payee and makes the new key wait `changeDelay` (domain-hijack protection).

Report sent to the contract: `abi.encode(bytes32 domainHash, address controller, bytes32 leiHash, uint8 action)`, action `1` = VERIFY, `2` = FREEZE.

## CRE features used
- `EVMClient` log trigger (generated binding `logTriggerRegistrationRequested`), `CronCapability` trigger
- `HTTPClient.sendRequest` with `consensusIdenticalAggregation` (every node must return the same result)
- EVM reads: `getPayee`, `domainCount`, `domainAt`; EVM write: `writeReport` → Forwarder → `onReport`

## Arc Testnet settings
- CRE chain name: `arc-testnet` (CRE TS SDK ≥ 1.3.1); RPC `https://rpc.testnet.arc.io`
- Simulation forwarder (MockKeystoneForwarder): `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1` — pass this as `forwarder` when deploying PayeeRegistry
- Production forwarder: `0x76c9cf548b4179F8901cda1f8623568b58215E62` (then also set `expectedAuthor` = workflow owner)
- Gas on Arc is USDC: fund `CRE_ETH_PRIVATE_KEY` from https://faucet.circle.com

## Run it
```bash
# 0. One time
# CRE CLI (official installer, docs.chain.link/cre/getting-started/cli-installation)
#   Windows PowerShell: irm https://app.chain.link/cre/install.ps1 | iex
#   macOS/Linux: see the docs page (install.sh)
# Bun >= 1.2.21 is required by @chainlink/cre-sdk (engines.bun)
cre version
cre login

# 1. Bindings from the contract ABI (re-run after any ABI change)
cd cre
cre generate-bindings evm

# 2. Dependencies + typecheck (the generated bindings in contracts/ need their own npm i)
cd contracts && npm i && cd ..
cd verifypay-workflow && npm i && npm run typecheck && cd ..

# 3. Config
#   verifypay-workflow/config.staging.json -> "registryAddress": "<PayeeRegistry on Arc Testnet>"
#   cre/.env -> CRE_ETH_PRIVATE_KEY=<testnet key funded with Arc USDC>   (never commit)

# 4. DNS: add TXT  _verifypay.<your-domain>  "arc:<your address>"   (optional: second TXT "lei:<LEI>")
#   then call requestRegistration("<your-domain>") on PayeeRegistry and copy the tx hash.

# 5. VERIFY (trigger 0, log)
cre workflow simulate verifypay-workflow --target staging-settings --broadcast \
  --non-interactive --trigger-index 0 --evm-tx-hash <requestRegistration tx hash> --evm-event-index 0

# 6. FREEZE: delete the TXT record, wait for DNS TTL, then run the daily job (trigger 1, cron)
cre workflow simulate verifypay-workflow --target staging-settings --broadcast \
  --non-interactive --trigger-index 1
```
If a flag differs in your CLI version, run `cre workflow simulate verifypay-workflow --target staging-settings --broadcast`
interactively and pick the trigger.

## Evidence to keep for judging
- [ ] Terminal output of the VERIFY simulation (both resolvers + the written action)
- [ ] Arc explorer link of the VERIFY `onReport` tx
- [ ] Terminal output + explorer link of the FREEZE tx after deleting the TXT record
- [ ] A reverted `payByName` (PayeeNotActive) right after the freeze
- [ ] Fill `docs/chainlink-cre-feedback.md`

## Files
| File | Purpose |
|---|---|
| `verifypay-workflow/workflow.ts` | Triggers, DNS/GLEIF fetch, decision, report write |
| `verifypay-workflow/main.ts` | Runner entry point |
| `verifypay-workflow/config.staging.json` | Chain, registry address, schedule, DNSSEC switch, gas |
| `verifypay-workflow/workflow.yaml`, `project.yaml` | CRE targets and RPC |
| `contracts/evm/src/abi/PayeeRegistry.abi` | ABI for `cre generate-bindings evm` |

## Troubleshooting
- **Typecheck errors on bindings:** re-run `cre generate-bindings evm`; the code expects `PayeeRegistry.logTriggerRegistrationRequested`, `getPayee`, `domainCount`, `domainAt`, `writeReport`.
- **`UnauthorizedForwarder` revert:** the registry was deployed with a different forwarder than the one the simulator uses.
- **No write on VERIFY:** both resolvers must return the same `arc:` record; wait for DNS propagation, check `dig TXT _verifypay.<domain>`.
- **Demo domain has no DNSSEC:** keep `"requireDnssec": false` for the demo; set `true` in production.

## Automatic runs: `cre/runner` (until DON deployment access is granted)
`cre/runner/runner.mjs` starts the **same workflow with the official CRE CLI**, automatically. It reimplements nothing.
- It watches `PayeeRegistry` for `RegistrationRequested` (polling Arc every 20 s). For each **Pending** domain it runs trigger 0
  (`cre workflow simulate … --broadcast --trigger-index 0 --evm-tx-hash <tx> --evm-event-index <i>`). Repeated requests for an
  Active or Frozen domain are skipped, so nobody can burn the CRE wallet's gas by spamming `requestRegistration`.
- Every `RECHECK_MINUTES` (default 30) it runs trigger 1, the re-check that freezes payees whose DNS proof is gone.
- One CLI run at a time (CRE wallet nonce), and one retry after 20 s when the public Arc RPC answers 429.

It needs the CRE CLI logged in (`cre login`, or `CRE_API_KEY`), Bun, and `cre/.env` with `CRE_ETH_PRIVATE_KEY`. It needs no
inbound connection, so no tunnel. It runs wherever those are available; the demo runs it on the team laptop.
```
cd cre/runner && npm i
node runner.mjs --dry-run --recheck-now   # real DNS + workflow, no transactions
node runner.mjs                           # broadcasting
```
With deployment access, `cre workflow deploy` replaces the runner: the DON runs the same two triggers itself.

**After a shutdown (Windows):** double-click `cre/runner/start.bat`. It opens https://verifypay-arc.vercel.app and starts the
runner, which catches up on every registration it missed (`.state.json` keeps the last checked block). For an immediate
re-check: `start.bat --recheck-now`. To start it automatically at login, put a shortcut to `start.bat` in `shell:startup`.
