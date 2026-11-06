# Implementation Plan

| | |
|---|---|
| Event | ETHGlobal Mumbai |
| Build window | From Thursday, November 5, 2026, 21:00 IST |
| Submission deadline | Sunday, November 8, 2026, 09:00 IST |
| Related | [PRD.md](PRD.md), [TRD.md](TRD.md), [ARCHITECTURE.md](ARCHITECTURE.md) |

## Approach

1. Contracts first, test-driven: unit and fuzz tests before implementation, invariant tests for escrow accounting.
2. Deploy early to Arc Testnet so every later step runs against real contracts and real USDC.
3. Integrate each sponsor for real in the main flow (Arc, Chainlink CRE, World ID). Test doubles live only in tests.
4. Build the application in Arc Studio, one screen per step, each committed separately.
5. Record every step in [AI_USAGE.md](../AI_USAGE.md): files changed, what AI did, what the team did.

## Phases and tasks

### Phase 1: Contracts and deployment

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| T1 | PayeeRegistry, SafeSend (USDC and EURC), AgentWallet with tests | 45 Foundry tests pass, including fuzz, invariant and EIP-712 compatibility | Done |
| T2 | Import the repository into Arc Studio and run the tests there | Tests pass in Studio; project link in README | Done |
| T3 | Deploy to Arc Testnet from Arc Studio | Three contracts deployed and source-verified | Done |

### Phase 2: Chainlink CRE

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| T4 | Install the CRE CLI, generate bindings, type-check the workflow | `npm run typecheck` is clean | Done |
| T5 | Verify a real domain from live DNS | `onReport` VERIFY transaction on Arc (tx `0x4a12...0a3f`) | Done |
| T6 | Freeze the domain after its DNS record is removed | `onReport` FREEZE transaction on Arc; payment by name reverts | Pending: needs the domain owner to remove the record |
| T7 | Run the workflow automatically (`cre/runner`) | New registrations verified without manual commands; scheduled re-check runs | Done |
| T8 | Optional LEI check against GLEIF | `lei:` record verified in a simulation | Implemented, not demonstrated with a live LEI |

### Phase 3: Application (built in Arc Studio)

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| T9 | Pay screen: live verdict, exact approval, `payByName` and `send` | Real payments on testnet | Done |
| T10 | Undo window: cancel and release | Escrow refunded and released on testnet | Done |
| T11 | History shield, including zero-value transfers | A real poisoning transfer is flagged (tx `0x7cd4...1f83`) | Done |
| T12 | My payments list from on-chain events | Instant and held payments listed with explorer links | Done |
| T13 | Business screen: registration, status, payout change | Status and queued changes shown live | Done |
| T14 | Agent screen: limits, funding, pause | Agent refused without a limit (`OverPerPayment`) and for an unverified domain (`PayeeNotActive`) | Done |
| T15 | How it works and Builders screens | Live CRE evidence and a working `inspectRecipient` check | Done |

### Phase 4: World ID

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| T16 | Device authorization flow and ID-token validation | Flow starts and polls against `auth.world.org`; 9 validation tests pass | Done |
| T17 | Same-human binding and EIP-712 approval signer | Different human refused; signer checked against the deployed contracts | Done |
| T18 | End-to-end approval with an Orb-verified account: raise agent limits, then the agent pays within them | `raiseLimits` transaction and a successful `agentPay` | In progress |

### Phase 5: Hosting, hardening and submission

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| T19 | Host the application (Vercel) and backend (Railway) | Public link works; secrets only in Railway | Done |
| T20 | Resilience against public RPC rate limits and wallet duplicate submissions | Reads use partner RPCs with fallback; duplicates resolved to the landed transaction | Done |
| T21 | Security review and threat model | [docs/security.md](../docs/security.md) with live evidence and declared gaps | Done |
| T22 | Documentation: README, architecture, PRD, TRD, this plan, agent rules | Documents current and consistent | Done |
| T23 | Demonstration video (under 4 minutes; script in ../specs/08-demo-submission.md) and submission | Submitted before the deadline | Pending |

## Remaining work, in order

1. T18: complete one World ID approval with the Orb-verified account, raise the agent's limits, run the agent.
2. T6: remove the demo domain's TXT record, run the scheduled re-check, record the FREEZE transaction, restore the record.
3. T23: record the demonstration and submit.

## Cut list

Applied in this order when time was short:

1. Embedded wallets for payers (Circle Wallets): cut; the application uses an injected wallet.
2. Live GLEIF demonstration: implemented but not demonstrated.
3. DON deployment of the workflow: pending Chainlink deployment access; the runner starts the same workflow with the
   official CLI in the meantime.

Never cut: real CRE verification, the undo escrow, the World ID approval path, and the application built in Arc Studio.
