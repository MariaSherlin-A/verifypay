# VerifyPay: instructions for Claude Code

The general rules for every AI agent are in [AGENTS.md](AGENTS.md). This file restates the binding rules and adds what is
specific to Claude Code.

## Product

**VerifyPay: address-poisoning protection and self-freezing USDC settlement on Arc.**
Payments to verified businesses settle in one block. Payments to look-alike (poisoned) or first-time addresses go into a
10-minute undo escrow. A Chainlink CRE workflow verifies each business's domain and re-checks it on a schedule, freezing
the business when its DNS proof disappears. Changing a payout wallet needs a fresh World ID approval plus a public delay
that the current wallet can cancel.

Target tracks: Arc (Best Smart Contracts with Advanced Stablecoin Logic), Chainlink (Best workflow with CRE), World
(World ID Agent Pass). A working demonstration matters more than additional features.

Source of truth: `specs/`. If the code and a specification disagree, stop and ask which is correct.

## Positioning

- Lead with the problem: address poisoning ($83.8M stolen across 270M attempts; a $50M USDT loss in December 2025), the
  automatic undo escrow, and the CRE auto-freeze. See `specs/00-idea.md`.
- Do not open with payee verification, GLEIF or DNS registration. Those are the mechanism, not the pitch.

## Operating rules

1. Read `specs/06-implementation.md` first. Work on one task at a time, in order.
2. Plan first: for any task touching more than two files, show a plan and wait for approval.
3. Contracts: tests first (unit and fuzz, invariant where relevant), then the implementation. `forge test` must pass.
4. Commit after every working task with a clear message. Never one large commit.
5. After each task, append to `AI_USAGE.md`: files touched, what the AI did, what the human did.
6. Never ask for, print or store private keys. Secrets only in `.env` (ignored by git). Testnets only.
7. Never invent SDK features, function names, endpoints or addresses. Use `specs/07-sponsors.md`. If unsure, say
   "I'm not sure" and mark it as an assumption.
8. Small diffs. No unrelated refactors. No new dependencies without asking.
9. Explain non-obvious code in plain language so the team can defend it in a three-minute judging session.
10. Never mock a sponsor integration in the main flow. Test doubles live only in test directories.

## Security rules

- Checks-effects-interactions; `nonReentrant` on every function that moves USDC.
- Explicit access control on every state-changing function (matrix in `specs/03-security.md`).
- Custom errors, an event on every state change, checked token calls.
- No unbounded loops over user-controlled arrays in state-changing functions.
- Signatures: EIP-712 with chain ID, verifying contract, nonce and deadline; reject malleable `s`.
- `onReport` accepts only the CRE forwarder; production also checks the workflow owner.
- Arc USDC: ERC-20 interface, 6 decimals, at `0x3600000000000000000000000000000000000000`. Never mix with `msg.value`
  (18 decimals).
- Before marking any contract done: `forge test`, then a self-review against `specs/03-security.md`.

## What exists

| Area | Contents |
|---|---|
| `src/`, `test/` | PayeeRegistry, SafeSend (USDC and EURC), AgentWallet; 45 Foundry tests including fuzz, invariants and EIP-712 compatibility |
| `cre/` | CRE workflow (log trigger and cron, two DNS-over-HTTPS resolvers, optional GLEIF, writes `onReport`); `cre/runner` starts it automatically |
| `studio-app/` | Web application built in Arc Studio (Pay, Undo window, My payments, History shield, Business, Agent, How it works, Builders) and its Bun backend |
| `server/` | Reference backend: World ID Agent Pass device flow and token validation, EIP-712 approval signer, history scan |
| `web/` | Reference web application without a build step |
| `agent/agent-pay.mjs` | AI agent paying a verified business by domain |

Hosting: web application on Vercel (https://verifypay-arc.vercel.app), backend on Railway, contracts on Arc Testnet.
Architecture details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

```bash
forge build | forge test -vvv | forge test --fuzz-runs 1000
cd cre && cre generate-bindings evm
cd cre/verifypay-workflow && npm i && npm run typecheck
cre workflow simulate verifypay-workflow --target staging-settings --broadcast
cd studio-app && bun install && bun run test:server && bun run typecheck && bun run build
cd studio-app && vercel deploy --prod                 # web application (pass the VITE_CRE_EVIDENCE_* build variables)
cd studio-app && railway up --service backend --ci    # backend
```

## Arc Studio

The application, backend, deployment and agent are built in Arc Studio by following `ARC_STUDIO_BUILD.md`. Claude Code
supports that work: the CRE workflow, tests, fixes, hosting and documentation. `web/` and `server/` are the reference
implementation the Studio application matches.

## Definition of done

Acceptance criteria met, tests pass, lint clean, committed, `AI_USAGE.md` updated.

## Style

Be concise. Flag risks early. Disagree when an approach is weak.
