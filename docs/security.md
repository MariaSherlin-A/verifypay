# VerifyPay: security model

**One rule runs through the design:** any action that *redirects* money is slow and can be cancelled.
Any action that *stops* money is instant.

- **Instant:** freezing a payee, pausing the agent, lowering limits, undoing an escrow.
- **Slow and cancellable:** trusting a new DNS key, changing a payout wallet, raising limits. Each of these waits
  out a public delay, and the legitimate owner can cancel it during that delay.

The design spec, with assets, attackers, invariants and the full access-control matrix, is in
[specs/03-security.md](../specs/03-security.md). This page covers how the deployed system defends itself and
what it still trusts.

## Threats and defenses

| # | Attack | Defense | Where |
|---|---|---|---|
| 1 | **Address poisoning**: a look-alike address planted in the victim's history | Each verified payout wallet reserves its *fingerprint* (first 4 + last 4 hex). A different address with the same fingerprint gets verdict `Lookalike`, is escrowed for 10 minutes with Undo, and is **never** auto-trusted | `PayeeRegistry.inspectRecipient`, `SafeSend.send`, `SafeSend.release` (only `FirstTime` escrows become trusted) |
| 1b | Poisoning of a counterparty that has **no** DNS | The app compares the pasted address with the addresses this wallet has really paid (SafeSend `Paid` events and released escrows) and shows the same red look-alike warning. On-chain the payment is still a first-time escrow | `studio-app/src/lib/counterparties.ts` |
| 2 | Wrong or first-time address | 10-minute escrow. Only the sender can `cancel`, and only before `releaseAt` (`NotSender`, `WindowOver`) | `SafeSend.cancel` |
| 3 | Theft of escrowed funds | `release` pays only the original recipient, and only after the window (`WindowOpen`) | `SafeSend.release` |
| 4 | An attacker registers their look-alike wallet as a business | Only the CRE workflow can verify. A wallet that collides with an existing fingerprint is rejected (`VerificationRejected` inside `onReport`, so a CRE delivery never reverts) and can never be rotated in (`LookalikeCollision`) | `PayeeRegistry._onVerify`, `requestPayoutChange`, `executePayoutChange` |
| 5 | **DNS hijack**: the TXT record now names the attacker's key | The payee is **frozen immediately**. The new key is queued for `changeDelay` and the current controller can cancel it. If DNS goes back to the old key, the queued change is dropped | `PayeeRegistry._onVerify`, `cancelControllerChange` |
| 6 | Domain expires, is sold, or the proof is removed | The daily CRE cron sees no matching record on an Active payee and writes FREEZE. `payByName` and `send` revert, and the agent is refused | `cre/verifypay-workflow/workflow.ts` `decide()`, `PayeeRegistry.onReport` |
| 7 | One DNS resolver lies or is poisoned | Google DoH and Cloudflare DoH must return the **same** controller, and every CRE node must return identical results (`consensusIdenticalAggregation`). Optional: require DNSSEC (`AD` flag) and an issued GLEIF LEI | `workflow.ts` |
| 8 | Fake verify or freeze reports | `onReport` accepts only the configured forwarder. With `expectedAuthor` set, only our workflow owner is accepted (production; see "Testnet caveat" below) | `PayeeRegistry.onReport` |
| 9 | **Stolen controller key** redirects the payout (invoice-redirection fraud) | A payout change needs the controller, plus an EIP-712 approval the backend signs only after a **fresh** World ID Agent Pass (`auth_time` check), plus `changeDelay`. The controller **or the current payout wallet** can cancel | `requestPayoutChange`, `cancelPayoutChange`, `server/src/server.js` |
| 10 | A different human approves the change (account takeover) | Same-human binding: the World `sub` that first approved for a domain or wallet must approve every later change | `server/src/server.js` (Studio copy: `studio-app/server/src/bindings.js`) |
| 11 | Signature replay or forgery | EIP-712 with chainId, verifying contract, per-domain **nonce** and **deadline**. High-`s` signatures are rejected | `PayeeRegistry._recover`, `AgentWallet.raiseLimits` |
| 12 | Rogue or compromised AI agent | Pays **only verified domains**, within per-payment and per-day caps that start at **0**. Raising a cap needs a World ID approval. The owner can lower caps or pause instantly | `AgentWallet.agentPay`, `raiseLimits`, `lowerLimits`, `setPaused` |
| 13 | Reentrancy, or a token that fails silently | `nonReentrant` on every SafeSend function that moves funds, checks-effects-interactions, token calls checked for a return value, only allow-listed tokens (USDC, EURC) | `SafeSend._pull`, `_push`, `_ok` |

### Live proof on Arc Testnet

| What | Evidence |
|---|---|
| Look-alike escrow: on-chain record of which wallet was imitated | `Escrowed(id 4, reason 1, imitated 0x040de498…fdAc)` in tx [0x96c1…a90d](https://explorer.testnet.arc.io/tx/0x96c19de51db4205da8129c1582f8c8ffa7c608c4e80e54b1629441b7e3e5a90d) |
| Undo of that look-alike payment | `Cancelled(id 4)` in tx [0x404c…1c0d](https://explorer.testnet.arc.io/tx/0x404ce3057fe5e8eadbd49866c9afc33901c685257b1ddcfb6670e8a6dc3a1c0d) |
| CRE verification from real DNS (both resolvers agreed) | `PayeeVerified` in tx [0x4a12…0a3f](https://explorer.testnet.arc.io/tx/0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f) |
| Agent refused without a human-approved limit | `agent payment refused: OverPerPayment(1000000, 0)` (simulation against the live AgentWallet) |
| Agent refused for an unverified domain | `agent payment refused: PayeeNotActive(0)` |

## What the system trusts

| Trust point | Why it is acceptable | Mitigation |
|---|---|---|
| The business's DNS account | It is already the root of trust for their website and email | A hijack still runs into rows 5 and 9: freeze, delay, cancel |
| The backend approval signer (signs only after World ID) | Without its signature, no payout change or limit raise can start | Even with the key stolen, every redirect waits out a public delay the owner can cancel. In production it would live in an HSM or multisig |
| The CRE forwarder | Chainlink's KeystoneForwarder verifies DON signatures before calling `onReport` | `expectedAuthor` pins our workflow owner |

### Testnet caveat: the simulation forwarder (found and documented by us)
The deployed registry trusts `MockKeystoneForwarder 0x6E9E…eDc1`, the forwarder that `cre workflow simulate --broadcast`
writes through. On 2026-11-06 we replayed our real CRE report as **read-only** `eth_call`s from a random address,
with no signatures and with garbage signatures. The mock forwarder accepted both, and it also accepted a report we
modified to FREEZE. We sent no transactions.

**So on testnet, anyone could push verify or freeze reports into this registry.** That is how a mock forwarder
behaves, not a bug in `PayeeRegistry`. The fix is the production setup, which needs no code change:
1. Get CRE deployment access (`cre account access`) and run `cre workflow deploy`.
2. Redeploy `PayeeRegistry` with the production KeystoneForwarder (`0x76c9…5E62`, to be confirmed in Chainlink's
   forwarder directory for Arc Testnet) and `expectedAuthor` = our workflow owner. Then redeploy `SafeSend` and
   `AgentWallet`, which store the registry address as immutable.
3. Re-run the same replay. It must now be rejected.

## Known gaps (declared, not hidden)
- `AgentWallet.agentPay` has no `nonReentrant`. It moves only allow-listed tokens to Active payees. We will add the
  guard in the same redeploy as the production forwarder.
- A daily check that fails because one resolver is briefly down freezes an Active payee. That is safe, but it can be
  disruptive. Planned: freeze only after N consecutive failed checks.
- The daily cron writes VERIFY again for every Active payee. Planned: write only on a change, and paginate the loop.
- Look-alike **business names** (e.g. `chrsnikhil-pay.info`) are out of scope. The optional GLEIF LEI check ties a
  domain to a registered legal entity.
- The History shield reads only the latest page of explorer transfers and says so in the UI.
- Out of scope: an attacker who controls DNS **and** the owner's World ID **and** goes unnoticed for the full delay.

## Tests
`forge test`: 45 tests covering unit cases, fuzzing, invariants (escrowed funds are always fully backed by the
contract's balance) and EIP-712 compatibility with the backend signer. `cd server && npm test`: 13 backend tests,
including ID-token validation and client authentication.
