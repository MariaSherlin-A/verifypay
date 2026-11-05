# 07 · Sponsors

## Arc: Best Smart Contracts with Advanced Stablecoin Logic ($3,000)
**Required:** built in Arc Studio (shareable project URL, Studio shown in demo); working frontend AND backend; architecture diagram; video + detailed docs on use of Arc Studio and Circle developer tools; GitHub link; **state the bounty name** in the submission.
**What we use:** USDC ERC-20 on Arc `0x3600000000000000000000000000000000000000` and EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 dp); software-to-software payments (`AgentWallet`: an AI agent pays verified businesses by domain within caps); conditional settlement (verified → instant, risky → escrow), multi-step settlement (escrow → cancel/release), delayed state changes; reusable `inspectRecipient()` (bonus: reusable contracts); Circle Console testnet faucet; Circle Wallets [should].
**Proof:** contract addresses + explorer tx (escrow, undo, payByName); Studio URL.
**Docs:** https://docs.arc.io · https://studio.arc.io · https://console.circle.com · contract addresses: https://docs.arc.io/arc/references/contract-addresses · EVM differences (decimals): https://docs.arc.io/arc/references/evm-differences

## Chainlink: Best workflow with CRE ($1,500)
**Required:** CRE workflow used as an orchestration layer; integrates a blockchain with an external API; successful simulation (CRE CLI) or deployment; meaningfully used.
**What we use:** EVM log trigger (`RegistrationRequested`), cron trigger (daily re-check), HTTP capability with `consensusIdenticalAggregation` to dns.google, cloudflare-dns.com, api.gleif.org; EVM read (`getPayee`, `domainCount`, `domainAt`); EVM write via Forwarder to `onReport`.
**Arc Testnet:** chain name `arc-testnet` (TS SDK ≥ 1.3.1); simulation Forwarder `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`; production `0x76c9cf548b4179F8901cda1f8623568b58215E62`.
**Proof:** simulate logs + two `onReport` tx (VERIFY, FREEZE) on the Arc explorer. Guide: `cre/README.md`; feedback: `docs/chainlink-cre-feedback.md`.
**Docs:** https://docs.chain.link/cre · forwarder directory https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts · templates https://github.com/smartcontractkit/cre-templates

## World: World ID Agent Pass ($5,000)
**Required:** official Agent Pass; full journey (request → user completion → validated result → protected action); a denied/expired/cancelled path where the action does not occur; validation in a secure backend (no client secrets, no trusting client responses); short debrief (time to first success, friction, missing capability/docs, top improvement).
**What we use:** Agent Pass gates TWO meaningful actions: `requestPayoutChange` (the moment redirection fraud happens) and `AgentWallet.raiseLimits` (before an AI agent can spend more). Same-human binding: only the World ID that first approved for a payee/wallet can approve later changes. Backend validates the token and only then signs the EIP-712 approval. Proofs are mocked by World at this event (stated on the prize page).
**Proof:** video of Deny (nothing changes) and Approve (countdown starts); backend validator code; debrief in `docs/world-debrief.md`.
**Docs:** https://auth.world.org/docs · portal https://auth.world.org/portal
[ASSUMPTION] endpoint names and claims: confirm in the docs or at the World booth.

## Submission wording (one line each)
- Arc: "Conditional USDC settlement on Arc: instant for verified payees, automatic 10-minute undo escrow for look-alike and first-time recipients, reusable `inspectRecipient()`."
- Chainlink: "CRE verifies business domains across two DNS resolvers by DON consensus and re-checks them daily, freezing a payee on-chain the moment its proof disappears."
- World: "Two moments need a real human: changing where a business gets paid, and letting an AI agent spend more. Each requires a fresh World ID Agent Pass check validated server-side and bound to the same human; deny and nothing changes."
