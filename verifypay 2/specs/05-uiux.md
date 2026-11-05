# 05 · UI/UX

Built and iterated in **Arc Studio** (import this repo "From GitHub"); show Studio in the video.

## Screens
1. **Pay** (default): recipient field (domain or address) → live verdict chip from `inspectRecipient`:
   - green **Verified · acme.com** → "Pay" (instant)
   - red **Look-alike of acme.com (0x8F4a…91B2)** → highlight the differing middle characters; button "Send with 10-min undo"
   - amber **First payment to this address** → "Send with 10-min undo"
   - grey **Frozen · verification lapsed** → disabled
2. **Pending**: escrow cards with countdown, big **Undo** button, then "Released" state; explorer links.
3. **History shield**: payer's recent transfers; poisoning attempts (dust/zero from look-alikes) flagged with "Never copy from this row".
4. **Business**: register domain (shows the exact TXT record to add + copy button), status (Pending/Active/Frozen, last verified), "Change payout wallet" → Agent Pass → countdown banner with Cancel for the old wallet.
5. **Builders**: code snippet `inspectRecipient(address)` + contract addresses.

## Wallet and transaction flows
- Connect (injected wallet on Arc Testnet; Circle Wallets if time). Auto-add chain 5042002.
- First pay: USDC `approve(SafeSend, amount)` then `send`/`payByName` (two tx; explain in UI).
- All amounts in USDC with 6 decimals; never show native 18-decimal values.

## States
Loading skeletons on verdict lookup; error toasts with the decoded custom error (`PayeeNotActive`, `WindowOver`, `NotSender`); empty states ("No pending payments"). Countdown uses chain time, not local clock.

## Accessibility basics
Verdict uses icon + text, not colour alone; buttons ≥ 44px; keyboard reachable; aria-live on the verdict chip.

## Click-by-click demo path
1. Pay → paste poisoned address → red chip → Send 500 → Pending card → Undo → balance restored (explorer tab).
2. Terminal: delete TXT → `cre workflow simulate … --trigger-index 1 --broadcast` → Business shows Frozen → Pay acme.com disabled.
3. Restore TXT → simulate trigger 0/1 → Active → Pay acme.com 500 → done in one block.
4. Business → Change payout → World App: Deny → "Not approved, nothing changed" → retry: Approve → 2:00 countdown + Cancel visible to old wallet.
