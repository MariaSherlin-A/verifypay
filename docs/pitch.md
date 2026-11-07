# VerifyPay: pitch for the judges

About four minutes of speaking, then questions. Lines in quotes are what you say. Lines in brackets are what you show.
Items marked [CHECK] are facts to confirm before you present; do not say them if you cannot confirm them.

---

## 1. The real problem: Europe already decided this matters (0:00 to 0:40)

[Slide or screen: the VerifyPay cover image]

"In Europe, sending money to the wrong account became a big enough problem that the EU made a law about it. Under the
Instant Payments Regulation, since October 2025 every bank in the euro area must check the payee before a transfer
goes out: you type a name and an IBAN, and the bank tells you whether they match, before the money leaves. It is
called Verification of Payee." [CHECK: Regulation (EU) 2024/886, applies from 9 October 2025]

"The reason is simple. Once a payment is sent to the wrong account, getting it back is slow and often impossible. So
the check has to happen before the money moves."

## 2. Stablecoins have no Verification of Payee (0:40 to 1:05)

"Stablecoins have the same problem and none of that protection. You pay a 42-character address, and an attacker can
create one that starts and ends with the same characters as your supplier's, send you a tiny transfer so it appears in
your history, and wait for you to copy it. This is address poisoning: 83.8 million dollars stolen across 270 million
attempts, and one person lost 50 million dollars in December 2025 from a single copied address."

"So we asked: what would Verification of Payee look like for USDC, if the check lived in the payment itself?"

## 3. Our first idea, and what Arc's feedback changed (1:05 to 1:40)

"Our first design checked the business's domain while the payment was being made. When we showed it to the Arc team
yesterday, their feedback was that domain verification is a separate workload from the payment, and should be
treated as one."

"That changed the architecture. Now verification runs on its own, ahead of time: a Chainlink CRE workflow checks the
business's DNS record and writes the result to our PayeeRegistry contract on Arc. The payment never calls DNS. It only
reads a status that is already on-chain, so a payment to a verified business settles in one transaction, and the
verification keeps running in the background on a schedule. If the DNS proof disappears, the workflow freezes that
business on-chain, and payments to it stop."

## 4. Why not just use ENS? (1:40 to 2:30)

"While building, we looked at ENS. ENS maps a name to an address, and every change to a record is visible on-chain,
so a wallet can notice when a name starts pointing somewhere new."

"But ENS has one weakness for payments: a change takes effect immediately. If an attacker gets control of the name, or
of the key that manages it, the very next payment goes to the attacker's address. Noticing the change does not help a
payment that has already been sent. There is no waiting period and no one can cancel it."

"On Arc we fixed exactly that, inside the contracts:"

- "A payout wallet change needs a fresh World ID approval from the same human who owns the business, and then it waits
  a public delay. During that delay, payments keep going to the old wallet, and the old wallet can cancel the change."
- "Payments to first-time or look-alike addresses are held for 10 minutes in an escrow the sender can undo."
- "The registry check and the transfer happen in the same Arc transaction, so nothing can change between the check and
  the payment."

"Arc is what makes this practical. USDC is the gas token, so an undo or a cancel costs cents in the same currency the
user already holds, and Arc's fast finality means a verified payment does not wait. We built it in Arc Studio:
contracts, frontend, backend and deployment." [CHECK: say "fast finality" the way Arc's docs describe it]

## 5. How it works, end to end (2:30 to 3:20)

[Show the architecture page, or demo live at https://verifypay-arc.vercel.app]

1. "The business publishes a DNS TXT record, `_verifypay.<domain>`, containing its Arc wallet address, and calls
   `requestRegistration`."
2. "That event triggers our Chainlink CRE workflow. It reads the record through two resolvers, Google and Cloudflare.
   Both must return the same address, and every CRE node must agree, using `consensusIdenticalAggregation`. The result
   is written to the registry through the CRE forwarder, and only the forwarder can write it."
3. "A cron trigger re-checks every business on a schedule and writes FREEZE when a proof disappears."
4. "When someone pays, SafeSend asks the registry. Verified business: paid instantly. First-time or look-alike address:
   held 10 minutes with Undo. Frozen business: rejected."
5. "Changing a payout wallet, or raising an AI agent's spending limit, needs a World ID approval. Our backend validates
   the World ID token on the server and only then signs an EIP-712 approval that the contract checks."
6. "And `inspectRecipient(address)` is public, so any wallet, dApp or AI agent on Arc can run the same check before it
   pays."

[Live demo, if there is time: paste the poisoning address `0x040D…FdaC` and show the look-alike warning; pay
`pay.chrsnikhil.info` and show instant settlement; show the CRE transaction on the How it works tab]

## 6. Sponsor requirements (3:20 to 3:45)

Say only what is true on the day. As of the last check:

"For Arc: built in Arc Studio, working frontend and backend, USDC and EURC settlement, advanced stablecoin logic with
escrow and undo, reusable contracts, an architecture diagram and documentation. All done."

"For Chainlink: CRE is the orchestration layer, it connects DNS and GLEIF data to Arc, and the workflow has broadcast a
real verification on Arc Testnet. It runs through the official CRE CLI, because DON deployment access is not yet
enabled for our account."

"For World: the official Agent Pass flow, validated in a secure backend, protecting a real action, with the denied and
expired paths leaving the action blocked." [If the Orb-verified approval has been completed, add: "and we completed a
full approval with an Orb-verified human." If not, do not claim it.]

## 7. Close (3:45 to 4:00)

"Europe made banks check the payee before money moves. VerifyPay brings that to stablecoins on Arc, with a check
that nobody, including us, can bypass. Pay the business, not the address."

---

## Cross-questions and answers

**1. Isn't this just an address book or a whitelist?**
No. An address book is local and trusts whatever you saved, including a poisoned address. Our registry is on-chain,
verified by a Chainlink CRE workflow against the business's DNS, re-checked on a schedule, and enforced by the contract
at payment time.

**2. Why not just use ENS?**
ENS changes take effect immediately, so a hijacked name redirects the next payment. We add a World ID approval, a public
delay the old wallet can cancel, and an undo escrow for risky payments. ENS also does not prove that a name belongs to a
real company's domain. We tie the business to its DNS domain, which customers already know.

**3. What if the business's DNS is hijacked?**
The attacker would need to publish a new address in the TXT record. A verify report naming a different controller does
not take effect immediately: the business is frozen and the change waits the delay, during which the real owner can
cancel. For production we would require DNSSEC; the workflow already supports checking it.

**4. Can the Chainlink nodes lie or be wrong?**
They can verify or freeze a business, but they can never move funds, and a controller change still waits the delay. Two
independent resolvers must agree, and every node must return the identical result.

**5. What if one DNS resolver is down? Could an honest business be frozen by mistake?**
Today a failed check can freeze a business, which stops payments but loses no money; the next successful check
re-verifies it. A grace period of several failed checks before freezing is our next improvement.

**6. Who controls the backend signer? Isn't that a central point of trust?**
The signer only signs after a valid World ID approval from the same human. It cannot move funds, cannot skip the delay
and cannot override a cancel. Both contracts check that the signature comes from the expected signer, with chain ID,
nonce and deadline.

**7. Can the team freeze funds or take money?**
No. There is no admin role after deployment: no owner on the registry or SafeSend, no upgrade, no pause, and no way for
the team to move user funds or unfreeze a business.

**8. Doesn't a 10-minute escrow annoy users?**
Only first-time and look-alike payments wait. Verified businesses, and addresses you have already paid through
VerifyPay, settle immediately.

**9. How do you detect a look-alike?**
We compare the first 4 and last 4 hex characters with every registered payout wallet, which is what people actually
check by eye. A matching address that is not the real one is flagged, and it can never be registered as a payout
wallet. For production we would compare more characters.

**10. Why does this need a blockchain?**
The escrow, the delay, the cancel and the freeze are rules nobody can bypass, including us. And `inspectRecipient` is a
public function any wallet or agent can call, so the protection is not locked inside our app.

**11. Why Arc?**
USDC is the gas token, so undo and cancel cost cents in the currency users already hold. Fast finality means verified
payments settle without waiting. The registry check and the transfer run in the same transaction. And Arc Studio let
us build and deploy the full app.

**12. Is the CRE workflow really running, or simulated?**
It runs through the official CRE CLI and broadcasts real transactions to Arc Testnet; the verification transaction is
shown live in the app. DON deployment access is not yet enabled for our account, so a small runner starts the workflow
for us. With access, `cre workflow deploy` replaces the runner.

**13. Is the World ID part working end to end?**
Answer truthfully on the day. The device flow, server-side validation and the contract checks are live, and the denied
and expired paths are tested. If the Orb-verified approval has not been completed, say so: it needs an Orb-verified
World App account.

**14. How does this scale to thousands of businesses?**
Payments only read one on-chain record, so they do not slow down. The scheduled re-check would need batching across many
domains, which we listed as a question for the Chainlink team.

**15. What happens if a business loses its wallet?**
It updates its DNS record and requests a payout change with World ID. The change waits the delay, during which the
current wallet can cancel if the request was not genuine.

**16. How would a real wallet use this?**
Call `inspectRecipient(address)` before showing the confirm screen, as in our Builders tab. It returns Verified, Frozen,
Look-alike or Unknown, and for a look-alike, the real payee it imitates.
