# Sponsor Qualification

How VerifyPay meets each sponsor's requirements for ETHGlobal Mumbai. Submission deadline: Sunday, November 8, 2026,
09:00 IST.

## Arc: Best Smart Contracts with Advanced Stablecoin Logic (in Arc Studio)

| Requirement | Evidence | Status |
|---|---|---|
| Built in Arc Studio, with a shareable project | https://studio.arc.io/app/d07d3246-b875-45b4-9cf4-4f5bfde5aeed; guide in [ARC_STUDIO_BUILD.md](ARC_STUDIO_BUILD.md) | Done |
| Working frontend and backend | https://verifypay-arc.vercel.app (Vercel) and its backend (Railway) | Done |
| USDC or EURC settlement | `SafeSend` (USDC and EURC), `AgentWallet` | Done |
| Advanced stablecoin logic | Verified payments settle instantly; risky payments go to an undo escrow with cancel and release; AI agent payments by domain within human-approved limits | Done |
| Reusable contracts | `PayeeRegistry.inspectRecipient(address)`, callable by any wallet, dApp or agent | Done |
| Architecture diagram | [ARCHITECTURE.md](ARCHITECTURE.md) | Done |
| Documentation | [README.md](README.md), `specs/`, `docs/` | Done |
| Arc Studio shown in the demonstration video | [specs/08-demo-submission.md](specs/08-demo-submission.md) | Pending |

## Chainlink: Best workflow with CRE

| Requirement | Evidence | Status |
|---|---|---|
| CRE workflow as the orchestration layer | `cre/verifypay-workflow/workflow.ts`: only the workflow can verify or freeze a business | Done |
| Blockchain integrated with external data | DNS-over-HTTPS (Google and Cloudflare), optional GLEIF, written to Arc | Done |
| Successful simulation or deployment | VERIFY broadcast on Arc: [0x4a12...0a3f](https://explorer.testnet.arc.io/tx/0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f) | Done |
| Automatic freeze demonstrated | FREEZE broadcast after the TXT record is removed | Pending |
| Documentation and feedback | [cre/README.md](cre/README.md), [docs/chainlink-cre-feedback.md](docs/chainlink-cre-feedback.md) | Done |

## World: World ID Agent Pass

| Requirement | Evidence | Status |
|---|---|---|
| Official Agent Pass flow | Device authorization against `auth.world.org` (`server/src/oidc.js`, `studio-app/server/src/server.js`) | Done |
| Result validated in a secure backend | ID-token validation with 9 tests; approval signed only after validation | Done |
| Protected action | Payout wallet change and agent limit increase require the signed approval | Done |
| Denied, expired or cancelled request leaves the action blocked | Backend, application and contracts | Done |
| End-to-end approval with an Orb-verified human | Raise agent limits, then the agent pays | In progress |
| Debrief | [docs/world-debrief.md](docs/world-debrief.md) | Done |

## ETHGlobal rules

| Rule | Evidence | Status |
|---|---|---|
| Code written during the event, steady commit history | One commit per task in the git history | Done |
| Specifications and prompts in the repository | `specs/`, `prompts/`, [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | Done |
| AI usage disclosed | [AI_USAGE.md](AI_USAGE.md) | Done |
| Public repository with a license | MIT [LICENSE](LICENSE) | Done |
| Demonstration video | Under four minutes; script in [specs/08-demo-submission.md](specs/08-demo-submission.md) | Pending |

## Real integrations in the main flow

Arc Testnet contracts with real USDC and EURC; the Chainlink CRE workflow reading live DNS and writing real `onReport`
transactions; World ID device authorization against `auth.world.org` with server-side validation. Test doubles exist
only in test directories.
