# Chainlink CRE: integration feedback (fill in during the build)

Project: VerifyPay · Track: Best workflow with CRE · Chain: Arc Testnet (`arc-testnet`)

## What we built with CRE
Log trigger on `RegistrationRequested` + daily cron; HTTP to two DNS-over-HTTPS resolvers (+ GLEIF) with
`consensusIdenticalAggregation`; EVM reads and `writeReport` to `PayeeRegistry.onReport` on Arc Testnet.

## Timeline
- Time from `cre init`/setup to first successful simulation:
- Time to first successful `--broadcast` write on Arc Testnet:

## What worked well
-

## Friction we hit
- Setup / login / CLI:
- Bindings generation:
- HTTP capability + consensus:
- Arc Testnet support (chain name, forwarder, gas in USDC):
- Simulation flags (log trigger tx hash, cron trigger):

## Missing capability or documentation
-

## The one improvement with the biggest impact
-

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
