# Sponsor qualification checklist (ETHGlobal Mumbai)

Deadline: **Sunday Nov 8, 09:00 IST** (submit by 07:00). Partner prizes selected: **Arc, Chainlink, World** (3 max).

## Arc: Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio ($3,000)
| Requirement | Where / status |
|---|---|
| Built in Arc Studio, shareable project URL | `ARC_STUDIO_BUILD.md` steps 0–1; paste URL in README + form ☐ |
| Show Studio in the demo | `specs/08-demo-submission.md` (2:30) ☐ |
| Functional MVP: working frontend **and** backend | `web/` + `server/` (or Studio-built equivalent) ☐ |
| Architecture diagram | `specs/02-TRD.md` Mermaid; Architecture page (Studio step 4) ☐ |
| Video + presentation + detailed docs on Arc Studio and Circle tools | `README.md`, `specs/`, video ☐ |
| GitHub repo link | ☐ |
| State the bounty name in the submission | "Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio" ☐ |
| USDC or EURC settlement | `SafeSend` (USDC `0x3600…0000` + EURC), `AgentWallet` ✅ |
| Advanced logic: conditional flows, multi-step settlement, software-to-software payments | Verified → instant; risky → undo escrow → cancel/release; AI agent pays by domain within caps ✅ |
| Bonus: reusable contracts | `inspectRecipient(address)` public check ✅ |
Other Arc bounties (DeFi app, Consumer agent with Discovery API, Bridge Kit non-USDC): not entered; one Arc bounty per submission is stated.

## Chainlink: Best workflow with CRE ($1,500)
| Requirement | Where / status |
|---|---|
| CRE workflow used as an orchestration layer | `cre/verifypay-workflow/workflow.ts` ✅ |
| Integrates a blockchain with an external API / data source | DNS-over-HTTPS (Google, Cloudflare) + GLEIF → Arc ✅ |
| Successful simulation (CLI) or deployment | VERIFY + FREEZE `--broadcast` tx on Arc explorer ☐ |
| Meaningful use | Only CRE can verify/freeze payees ✅ |
| Docs + feedback | `cre/README.md`, `docs/chainlink-cre-feedback.md` ☐ fill |
CCIP track: not entered.

## World: World ID Agent Pass ($5,000)
| Requirement | Where / status |
|---|---|
| Official Agent Pass | `server/src/oidc.js`, `server/src/server.js` ✅ code / ☐ live |
| Full journey request → completion → validated result → protected action | `docs/world-integration.md` ✅ |
| Denied / expired / cancelled path, action does not occur | backend + UI + contract ✅ code / ☐ in video |
| Validation in a secure backend | `validateIdToken` + 13 tests ✅ |
| Debrief | `docs/world-debrief.md` ☐ fill |
IDKit track: not entered (see `docs/world-integration.md`).

## ETHGlobal rules
| Rule | Status |
|---|---|
| Code written during the event, steady commit history | ☐ commit per task |
| Spec-driven planning files and prompts in the repo | `specs/`, `prompts/`, `CLAUDE.md` ✅ |
| AI usage disclosed | `AI_USAGE.md` ✅ keep updated |
| Public repo, license | MIT `LICENSE` ✅ |
| Demo video (≤ 3–4 min) | ☐ |

## "No mocks" rule in the main flow
Real: Arc Testnet contracts and USDC/EURC, Chainlink CRE simulation with real DNS/GLEIF data and real `onReport` tx,
World Agent Pass (proofs mocked **by World** at this event, as their prize page states). Test doubles exist only in `test/`.
