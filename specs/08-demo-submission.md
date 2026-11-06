# 08: Demo and submission

## Demo video script (target 3:45, hard limit 4:00)

Narration is about 540 words at a calm pace. Record each scene separately and cut out wallet waits; the times below
are for the edited video. Everything shown is live on Arc Testnet at https://verifypay-arc.vercel.app.

| Time | Scene | On screen | Narration |
|---|---|---|---|
| 0:00-0:20 | Problem | Title card: "$50M lost to one copied address (Dec 2025). $83.8M stolen across 270M poisoning attempts." | "In December 2025, someone lost fifty million dollars by copying an address from their own wallet history. It wasn't a hack. A scammer had sent them a tiny transfer from an address that starts and ends like the real one. This is address poisoning, and VerifyPay stops it on Arc." |
| 0:20-0:45 | History shield | Pay tab, connected wallet. Scroll to History shield; it flags the poisoning transfer and shows the character diff. | "This is my wallet on Arc Testnet. The History shield scans my transfers, including the zero-value ones the explorer hides, and flags this one. It copies a business I really pay. Only the middle characters differ." |
| 0:45-1:25 | Look-alike caught, then undone | Copy the flagged address into Pay. Red Look-alike verdict with diff. Send 1 USDC, sign in MetaMask. Undo window shows it held for 10 minutes. Press Undo. Balance returns; open the Cancelled transaction in the explorer. | "Say I copy it by mistake. Before I sign, the app asks the PayeeRegistry contract, and it answers look-alike. Even if I send anyway, the money does not reach the scammer. SafeSend holds it for ten minutes. I press Undo and the full amount comes back. That rule is in the contract, not in our website." |
| 1:25-1:45 | Verified payment | Type `pay.chrsnikhil.info`. Green Verified. Pay 1 USDC. Result "Settled instantly"; it appears in My payments. | "When I pay a verified business by name, it settles in one block. Only risky payments wait." |
| 1:45-2:30 | Chainlink CRE verifies and freezes | How it works tab: live CRE evidence (VERIFY transaction, `PayeeVerified`). Show the TXT record `_verifypay.pay.chrsnikhil.info`. Remove it, run `node cre/runner/runner.mjs --recheck-now`, open the FREEZE transaction, Pay shows Frozen. Restore the record. | "Who decides a business is verified? Not us. A Chainlink CRE workflow reads the business's DNS record through Google and Cloudflare. Both must agree, and the result is written on Arc through the CRE forwarder. Here is that transaction. The workflow re-checks every business on a schedule. When the record disappears, it writes FREEZE, and payments to that business stop in the same block." |
| 2:30-3:10 | World ID for changes that need a human | Agent tab: raise the limit. World ID link and QR. Deny in World App: "Nothing changed". Start again, approve: `raiseLimits` transaction confirms and the new caps show. | "Some changes need a real person. Raising my AI agent's spending limit, or changing a business's payout wallet, needs a fresh World ID approval. If I deny it, nothing changes. When I approve, our backend validates the World ID token on the server and only then signs the approval the contract checks. Payout changes also wait a public delay that the current wallet can cancel." |
| 3:10-3:25 | AI agent | Terminal: `node agent/agent-pay.mjs pay.chrsnikhil.info 1` succeeds. `node agent/agent-pay.mjs pay.chrsnikhil.info 2` is refused by the cap. | "The agent pays businesses by name, so it can't be poisoned, and it can never spend more than a human approved." |
| 3:25-3:45 | Built in Arc Studio, close | Arc Studio project, the architecture page, `forge test` passing (45 tests). End card: repository link and "Pay the business, not the address." | "We built VerifyPay in Arc Studio: three contracts with 45 Foundry tests, a CRE workflow and World ID. `inspectRecipient` is public, so any wallet or agent can use it. VerifyPay: pay the business, not the address." |

### Before recording
- MetaMask: Arc Testnet RPC set to `https://rpc.blockdaemon.testnet.arc.io`; the wallet holds a few USDC for gas and payments.
- Record on https://verifypay-arc.vercel.app, not the Arc Studio preview.
- `cre/runner` is running; the friend controlling `pay.chrsnikhil.info` is ready to remove and restore the TXT record.
- World App is signed in with the Orb-verified account; the agent wallet is funded and its owner is the connected wallet.
- Explorer tabs open for the VERIFY transaction (`0x4a120ed6...0a40a3f`) and the poisoning transfer (`0x7cd4b778...a7c627dca1f83`).
- Screen at 1920x1080, browser zoom 110 to 125 percent, notifications off.
- If a scene fails live, use the backup recording of that scene; never show results that did not happen.

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
