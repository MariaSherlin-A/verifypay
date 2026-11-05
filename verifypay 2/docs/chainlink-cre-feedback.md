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
- VERIFY tx:
- FREEZE tx:
- Simulation logs: (paste or link)
