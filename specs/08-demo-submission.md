# 08 · Demo and submission

## 3-minute demo script
| Time | Shot | Line |
|---|---|---|
| 0:00 | Headline: $50M USDT lost to one copy-paste (Dec 2025); $83.8M across 5,500 victims | "Copy-paste the wrong address and your USDC is gone forever." |
| 0:15 | Pay → paste poisoned address → red "Look-alike of acme.com" → Send 500 → escrow → **Undo** → balance back (explorer) | "VerifyPay caught it on-chain and gave the money back." |
| 0:50 | Delete TXT → CRE simulate → Frozen → Pay disabled | "Chainlink's nodes re-check every business daily. Proof gone, payments stop." |
| 1:20 | Restore → verify → Pay acme.com → one block | "Verified businesses settle instantly." |
| 1:40 | Change payout → World App Deny → nothing changes → Approve → countdown + Cancel | "A stolen session can't redirect money. A real human must approve, and the old wallet can still cancel." |
| 2:05 | Terminal: `node agent/agent-pay.mjs acme.com 1.25` → paid; freeze Acme → agent refused; raise limits → World App | "AI agents pay businesses by name, within caps, and can't be poisoned. Spending more needs a human." |
| 2:30 | Arc Studio project, architecture diagram, `forge test` (45 tests, invariants) | "Built in Arc Studio; any wallet or agent can call `inspectRecipient()`." |
| 2:50 | Close | "Pay the business, not the address." |

## Demo-failure fallback
- Pre-record the full run at hour 16 and again at freeze.
- Keep explorer tabs of all key tx open.
- CRE: keep the simulate output from a successful run; if network fails, show logs + tx.
- World: if Agent Pass is down, show the recorded deny/approve and the validator code.

## Submission checklist
- [ ] Public repo, MIT license, steady commit history
- [ ] README: problem, architecture diagram, contract addresses, tx links, how to run, trust assumptions, out-of-scope
- [ ] **Arc:** Studio project URL; Studio shown in video; bounty name stated; frontend + backend
- [ ] **Chainlink:** workflow code + simulate evidence + onReport tx
- [ ] **World:** deny path in video; `docs/world-debrief.md`
- [ ] AI_USAGE.md complete; /specs and /prompts committed (ETHGlobal spec-driven rule)
- [ ] Partner prizes selected: Arc, Chainlink, World
- [ ] Submit before Sun 07:00 IST (deadline 09:00)

## Judge Q&A (8 hardest)
1. **"Isn't this Meigi?"** Meigi is a Japanese payee registry with one attester key and no undo. We intercept address poisoning on-chain, undo automatically, and use Chainlink's DON with daily re-checks that auto-freeze.
2. **"Why blockchain?"** The escrow, delays and freeze are rules nobody can bypass, including us, and `inspectRecipient()` is a public check any wallet can call.
3. **"What if DNS is hijacked?"** The payee freezes and the new key waits the full delay; the real owner cancels. Production requires DNSSEC.
4. **"Can CRE nodes lie?"** They can freeze (DoS) but never move funds; controller changes are delayed and cancellable.
5. **"Fingerprint collisions?"** 32 bits for the demo; collisions are rejected, never overwritten. Production widens to 6+6 hex.
6. **"Doesn't escrow annoy users?"** Only first-time, unverified or look-alike payments wait; verified and trusted ones settle in one block.
7. **"Who signs approvals?"** A backend key that signs only after validating Agent Pass server-side; it can only queue a delayed, cancellable change.
8. **"Arc specifics?"** USDC is gas; we use the 6-decimal ERC-20 interface and never mix it with 18-decimal native values.
