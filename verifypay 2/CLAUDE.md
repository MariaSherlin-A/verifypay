# VerifyPay: ETHGlobal Mumbai build (LOCKED IDEA)

**VerifyPay: the address-poisoning interceptor and self-freezing USDC settlement layer on Arc.**
Payments to verified businesses settle in one block. Payments to look-alike (poisoned) or first-time
addresses go into a 10-minute undo escrow. A Chainlink CRE workflow verifies each business's domain
and re-checks it daily, freezing the payee when its DNS proof disappears. Changing a payout wallet
needs a fresh World ID Agent Pass check plus a public delay the old wallet can cancel.

## Mission
Win: Arc "Best Smart Contracts with Advanced Stablecoin Logic", Chainlink "Best workflow with CRE",
World "World ID Agent Pass". Reach finalist. A working demo beats more features.
Source of truth: /specs. If code and spec disagree, STOP and ask which is right.

## Positioning rules (judges have seen Meigi, ETHGlobal Tokyo 2026)
- NEVER open with "Verification of Payee", GLEIF or DNS registration. Those are plumbing.
- ALWAYS lead with: address poisoning ($83.8M stolen, 270M attempts; $50M USDT loss Dec 2025),
  automatic undo escrow, and the CRE auto-freeze. See specs/00-idea.md.

## Operating rules (non-negotiable)
1. Read specs/06-implementation.md first. Work on ONE task at a time, in order.
2. Plan first: any task touching more than 2 files, show a plan and wait for approval.
3. Contracts: tests first (unit + fuzz, invariant where relevant), then implement. `forge test` must pass.
4. Commit after every working task, clear message, never one giant commit (ETHGlobal + Whitechain-style judges check history).
5. After each task append to AI_USAGE.md: files touched, what AI did, what the human did.
6. Never ask for, print, or store private keys. Secrets only in .env (gitignored). Testnets only.
7. Never invent SDK features, function names, endpoints or addresses. Use specs/07-sponsors.md. If unsure, say "I'm not sure" and mark [ASSUMPTION].
8. Small diffs. No unrelated refactors. No new dependencies without asking.
9. Explain non-obvious code in plain language so the human can defend it in the 3-minute judge Q&A.
10. Never mock a sponsor integration in the main flow. Test doubles live only in /test.

## Security rules
- Checks-effects-interactions; nonReentrant on every function that moves USDC.
- Explicit access control on every state-changing function (matrix in specs/03-security.md).
- Custom errors, an event on every state change, checked token calls (return value or revert).
- No unbounded loops over user-controlled arrays in state-changing functions.
- Signatures: EIP-712 with chainId, verifying contract, nonce and deadline; reject malleable s.
- `onReport` accepts only the CRE Forwarder; production also checks the workflow owner.
- Arc USDC: use the ERC-20 interface (6 decimals) at 0x3600000000000000000000000000000000000000. Never mix with msg.value (18 decimals).
- Before marking any contract done: `forge test`, then self-review against specs/03-security.md.

## Sponsor docs
Before marking anything sponsor-related done, check SPONSOR_QUALIFICATION.md, cre/README.md and docs/world-integration.md.

## Arc Studio
The app, backend, deployment and agent are built in Arc Studio by following ARC_STUDIO_BUILD.md step by step. Claude Code supports that work: CRE workflow, tests, fixes, docs. `web/` and `server/` are the reference implementation Studio should match.

## What already exists (do not rebuild)
- `src/`: PayeeRegistry, SafeSend (USDC + EURC), AgentWallet. `test/`: 45 Foundry tests incl. fuzz, invariants, EIP-712 compatibility.
- `cre/`: Chainlink CRE workflow (log trigger + cron, 2 DoH resolvers + GLEIF, writes onReport).
- `server/`: Node 22 backend (one dep: viem). World Agent Pass device flow + ID-token validation (12 unit tests), EIP-712 approval signer, poisoning history scan, static hosting.
- `web/`: no-build web app (viem from esm.sh): Pay, Undo window, History shield, Business, Agent wallet.
- `agent/agent-pay.mjs`: an AI agent paying a verified business by domain.

## Stack
Foundry (solc 0.8.28) | Node 22 backend + static web app (viem); iterate UI in Arc Studio |
Chain: Arc Testnet (5042002) | Chainlink CRE TS SDK (`@chainlink/cre-sdk`) | World ID Agent Pass |
Arc Studio (studio.arc.io) + Circle Console (console.circle.com, Testnet)

## Commands
forge build | forge test -vvv | forge test --fuzz-runs 1000
cd cre && cre generate-bindings evm
cd cre/verifypay-workflow && npm i && npm run typecheck
cre workflow simulate verifypay-workflow --target staging-settings --broadcast
cd server && npm i && npm test && npm start   # serves web/ at http://localhost:8787

## Definition of done (per task)
Acceptance criteria met, tests pass, lint clean, committed, AI_USAGE.md updated.

## Style
Be concise. Flag risks early. Disagree with me if my approach is weak.
