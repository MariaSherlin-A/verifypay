# Agent Guidelines

Instructions for AI coding agents (Arc Studio, Claude Code, Codex and others) working in this repository. Human
contributors should follow the same rules.

## Project

VerifyPay protects stablecoin payments on Arc from address poisoning. Payments to verified businesses settle instantly;
payments to look-alike or first-time addresses are held in a 10-minute undo escrow. A Chainlink CRE workflow verifies
each business's domain from DNS and freezes it when the proof disappears. Payout changes and agent limit increases need a
fresh World ID approval and a public delay.

Read before changing anything: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the specifications in
`specs/` (`01-PRD.md`, `02-TRD.md`, `03-security.md`, `06-implementation.md`). The specifications are the source of
truth. If the code and a specification disagree, stop and ask which one is correct.

## Repository map

| Path | Contents |
|---|---|
| `src/`, `test/` | Solidity contracts and Foundry tests |
| `script/` | Deployment script |
| `cre/` | Chainlink CRE workflow (`verifypay-workflow/`), generated bindings (`contracts/`), runner (`runner/`) |
| `studio-app/` | Web application (`src/`) and its backend (`server/`), built in Arc Studio |
| `server/` | Reference backend; `studio-app/server` is derived from it |
| `web/` | Reference web application without a build step |
| `agent/` | AI agent that pays through AgentWallet |
| `docs/`, `specs/` | Documentation and specifications |

## Commands

```bash
forge build && forge test                       # contracts (45 tests)
forge test --fuzz-runs 1000                     # deeper fuzzing
cd server && npm install && npm test            # reference backend tests
cd studio-app && bun install
bun run test:server                             # application backend tests
bun run typecheck && bun run build              # web application
bun run server                                  # backend on :8787
cd cre && cre generate-bindings evm             # after any PayeeRegistry ABI change
cd cre/verifypay-workflow && npm run typecheck
cre workflow simulate verifypay-workflow --target staging-settings --broadcast
```

## Working rules

1. Work on one task at a time, in the order of `specs/06-implementation.md`.
2. For any change touching more than two files, present a plan and wait for approval.
3. Contracts are test-first: unit and fuzz tests (invariants where relevant) before the implementation. `forge test` must
   pass before a change is complete.
4. Commit after each working task with a clear message. Do not combine unrelated work into one commit.
5. After each task, add a row to `AI_USAGE.md`: files changed, what the agent did, what the human did.
6. Keep diffs small. No unrelated refactoring. No new dependencies without approval.
7. Explain non-obvious code in plain language so the team can defend it to reviewers.
8. Do not invent SDK features, function names, endpoints or addresses. Check `specs/07-sponsors.md` and the official
   documentation. If unsure, say so and mark the statement as an assumption.

## Integrity rules

- Sponsor integrations (Arc, Chainlink CRE, World ID) are real in the main flow. Mocks and test doubles belong only in
  test directories.
- Never fabricate data, transaction hashes, test results or evidence. Report failures as they are.
- State testnet limitations openly (for example, CRE runs through the simulation forwarder until DON access is granted).

## Security rules

- Never request, print, log or commit private keys, API keys or client secrets. Secrets live only in `.env` files
  (ignored by git) and in hosting environment variables. Never use the `VITE_` prefix for a secret.
- Testnets only.
- Contracts: checks-effects-interactions, `nonReentrant` on every function that moves funds, explicit access control on
  every state-changing function (see `specs/03-security.md`), custom errors, an event for every state change, checked
  token calls, no unbounded loops over user-controlled data in state-changing functions.
- Signatures: EIP-712 with chain ID, verifying contract, nonce and deadline; reject malleable `s` values.
- `onReport` accepts only the CRE forwarder; production also checks the workflow owner.
- Arc USDC: use the ERC-20 interface at `0x3600000000000000000000000000000000000000` with 6 decimals. Never mix it with
  the native balance, which uses 18 decimals.

## Arc Testnet reference

| Item | Value |
|---|---|
| Chain ID | 5042002 |
| Public RPC | `https://rpc.testnet.arc.io` (rate-limited per IP) |
| Partner RPCs | `https://rpc.blockdaemon.testnet.arc.io`, `https://rpc.drpc.testnet.arc.io` |
| Explorer | `https://explorer.testnet.arc.io` |
| Log range limit | About 10,000 blocks per query |
| PayeeRegistry | `0xc2035DA8766Fa4F68D405857A155dB52F15790cc` |
| SafeSend | `0x88E2AFe1308CA7127D1c11926Dd4879c8b8e1924` (deployment block 70,933,971) |
| AgentWallet | `0xe905031D8C16d668282d917182D829CAc6C45358` |

In the web application, addresses come from `GET /api/config`; do not hard-code them in `studio-app/src`.

## Definition of done

Acceptance criteria met, tests pass, type check and lint clean, changes committed, `AI_USAGE.md` updated.
