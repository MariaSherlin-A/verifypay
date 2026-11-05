# 06 · Implementation plan

Hacking started Nov 5, 21:00 IST. Submission: **Sun Nov 8, 09:00 IST**. Hour 0 = 21:00 Thu.

| ID | Task | Files | Acceptance criteria | Tests | Deps | Est | Status |
|---|---|---|---|---|---|---|---|
| T1 | Contracts + tests (Registry, SafeSend USDC+EURC, AgentWallet, EIP-712 compat) | src/, test/ | 45 tests incl. fuzz + invariants pass | forge test | – | – | DONE |
| T2 | Push repo to GitHub; import into Arc Studio "From GitHub"; run tests in Studio (ARC_STUDIO_BUILD.md steps 0–1) | – | Studio project URL saved in README | Studio test run | T1 | 0.5h | DONE (45 tests in Studio) |
| T3 | Deploy to Arc Testnet from Studio (ARC_STUDIO_BUILD.md step 2) | script/ | Registry + SafeSend addresses in README, verified on explorer | – | T2 | 0.5h | DONE |
| T4 | CRE: install CLI, `cre login`, `cre generate-bindings evm`, typecheck | cre/ | `npm run typecheck` clean | – | T3 | 1h | |
| T5 | **CRE verify broadcast** on a real domain TXT | cre/ | onReport VERIFY tx on Arc explorer | – | T4 | 1h | |
| T6 | **CRE freeze broadcast** (delete TXT, cron trigger) | cre/ | onReport FREEZE tx on explorer | – | T5 | 0.5h | |
| T7 | Web: Pay screen + verdict chip + send/payByName + approve | web/ | Real USDC payments on testnet | manual | T3 | 1h (code written: test on testnet) | CODE DONE |
| T8 | Web: Undo window, Release | web/ | Escrow → Undo restores balance | manual | T7 | 0.5h (test) | CODE DONE |
| **H16** | **Minimum demoable version (by Fri 13:00): T3, T5, T6, T7, T8 live on testnet** | | | | | | |
| T9 | Backend Agent Pass (device flow) + validation + denied path | server/ | Deny → no sig; Approve → valid EIP-712 sig | 12 unit tests pass | T3 | 1.5h (register app, confirm discovery, live test) | CODE DONE |
| T10 | Business screen: register, status, change payout + countdown + cancel | web/ | Full rotation on testnet | manual | T9 | 0.5h (test) | CODE DONE |
| T11 | History shield (explorer API scan) | server/, web/ | Real dust transfer flagged | 4 unit tests | T7 | 0.5h (stage a real dust tx from a look-alike) | CODE DONE |
| T11b | Agent wallet: deploy, fund, run agent/agent-pay.mjs; raise limits via Agent Pass | agent/, web/ | Agent pays acme.com; frozen payee refused; raise needs World | forge tests | T9 | 1h | CODE DONE |
| T12 | GLEIF LEI in CRE | cre/ | `lei:` TXT verified via api.gleif.org | simulate | T5 | 1h | |
| T13 | Circle Wallets sign-in (Console testnet) | web/ | Payer pays without extension | manual | T7 | 2h | |
| T14 | Freeze: `/security-pass`, fix criticals, `--fuzz-runs 1000` | all | No high findings open | forge | all | 1h | |
| T15 | README, architecture diagram, AI_USAGE.md, World debrief | docs | Checklist in 08 complete | – | all | 2h | |
| T16 | Record demo video (≤3 min), submit | – | Submitted before Sun 07:00 | – | all | 2h | |

## Cut-list (in order, if behind)
1. T13 Circle Wallets → injected wallet only.
2. T12 GLEIF.
3. T11 History shield (keep the contract-level look-alike verdict).
4. Builders screen.
**Never cut:** T5, T6, T8, T9 denied path, Studio in the demo.
