# Chainlink CRE: integration feedback (fill in during the build)

Project: VerifyPay · Track: Best workflow with CRE · Chain: Arc Testnet (`arc-testnet`)

## What we built with CRE
Log trigger on `RegistrationRequested` + daily cron; HTTP to two DNS-over-HTTPS resolvers (+ GLEIF) with
`consensusIdenticalAggregation`; EVM reads and `writeReport` to `PayeeRegistry.onReport` on Arc Testnet.

## Timeline (2026-11-06, Windows 11, CRE CLI v1.39.0, Bun 1.4.4)
- Install, login, bindings and typecheck: about 30 minutes, most of it the two issues under "Friction".
- First successful simulation (dry run, no broadcast): right after typecheck. Both resolvers returned the controller, `action=1 (dns-match)`.
- First successful `--broadcast` write on Arc Testnet: about a minute later, [tx 0x4a12…0a3f](https://explorer.testnet.arc.io/tx/0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f).

## What worked well
- `arc-testnet` worked as a chain name with no extra flags. Gas paid in USDC from the `CRE_ETH_PRIVATE_KEY` wallet worked as usual.
- Replaying the log trigger with `--trigger-index 0 --evm-tx-hash … --evm-event-index 0` against a real `requestRegistration` tx lets you reproduce a run exactly. We used it for a dry run first, then the broadcast.
- `consensusIdenticalAggregation` on HTTP made the "two resolvers must agree" rule simple to express.
- `cre generate-bindings evm` produced typed `logTrigger…`, view-call and `writeReport` helpers straight from our ABI.
- The simulator printed our `runtime.log` lines and the write tx hash, which is all the evidence a demo needs.

## Friction we hit
- **Setup / CLI:** our own docs had `npm i -g @chainlink/cre-cli`, which does not exist on npm. The real installer is `irm https://app.chain.link/cre/install.ps1 | iex` (Windows). The installer warns that Bun is missing but does not offer to install it, even though `@chainlink/cre-sdk` requires `bun >= 1.2.21`.
- **Windows PATH:** after the installer, an already-open VS Code terminal still had the old PATH, so `cre` was "not recognized" until we reloaded `$env:Path` or restarted VS Code.
- **Bindings generation:** the generated TypeScript goes into `contracts/evm/ts/generated/`, and `contracts/` has its own `package.json`. Until we also ran `npm i` there, the workflow's `tsc` failed with `Cannot find module 'viem'` / `'@chainlink/cre-sdk'` plus dozens of implicit-`any` errors.
- **Simulation forwarder:** the simulator writes through `MockKeystoneForwarder`, which accepts reports without valid signatures (we checked with read-only `eth_call` replays). That is expected for a mock, but we did not see it stated where the forwarder addresses are listed. A one-line warning there would stop teams from treating a mock-forwarder deployment as secure.

## Missing capability or documentation
- A recommended pattern for a **grace period** (act only after N consecutive failed HTTP checks), so one flaky resolver cannot freeze an honest business.
- Guidance on **scaling a cron job over many on-chain records** (pagination, or one report per run with a batch of changes).
- How a hackathon team should request and speed up **deployment access** (`cre account access`) before a deadline.

## The one improvement with the biggest impact
Make `cre generate-bindings` (or `cre init`) install the dependencies of the generated `contracts/` package, or put the
bindings inside the workflow package. It was the only step that broke a fresh checkout, and the error points at
generated code rather than at the missing install.

## Questions for the Chainlink team (answers to be added after judging)
- Best CRE pattern for a grace period before a destructive write (freeze)?
- How to batch the daily re-check across thousands of domains?
- Can we get deployment access to run this on a live DON?
- Should DNSSEC (`AD` flag) be required in production?

## Evidence
- VERIFY tx (2026-11-06, CRE CLI v1.39.0, `--broadcast`, trigger 0 = RegistrationRequested log):
  https://explorer.testnet.arc.io/tx/0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f
  CRE key 0xd99e…6Ed9 -> MockKeystoneForwarder 0x6E9E…eDc1 -> PayeeRegistry 0xc203…90cc; events `PayeeVerified`, `ReportProcessed`.
  Trigger tx (requestRegistration "pay.chrsnikhil.info" from business 0x040d…fdAc): 0xfce20119b2e540b802078e4afb79f8ff9e36f453cb8720f2288d6948d892ea5c
  After: `resolve(keccak256("pay.chrsnikhil.info"))` = (0x040de4982BD04c10821Bd4375C1F1E96862cfdAc, 2 = Active).
- FREEZE tx:
- Simulation logs (VERIFY):
  ```
  [USER LOG] pay.chrsnikhil.info: google={"ok":true,"ad":false,"controller":"0x040de4982bd04c10821bd4375c1f1e96862cfdac","lei":""} cloudflare={"lei":"","ok":true,"ad":false,"controller":"0x040de4982bd04c10821bd4375c1f1e96862cfdac"}
  [USER LOG] action=1 (dns-match) tx=0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f
  ```
- Setup friction worth reporting: `cre generate-bindings evm` writes bindings into `contracts/` with its own package.json,
  so `tsc` in the workflow fails with "Cannot find module 'viem'" until `npm i` is also run in `contracts/`.
  Windows: after the installer, an already-open VS Code terminal keeps the old PATH (restart VS Code or reload `$env:Path`).
