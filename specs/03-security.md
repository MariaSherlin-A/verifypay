# 03 · Security

## Assets
USDC held in SafeSend escrow; correctness of payee → payout mapping; payee status (Active/Frozen).

## Attackers
Address poisoner; email/session hijacker; DNS hijacker; malicious look-alike business; griefer; compromised backend signer; spoofed CRE caller.

## Top 8 vulnerabilities and mitigations
| # | Threat | Mitigation | Test |
|---|---|---|---|
| V1 | Forged CRE report | `onReport` requires `msg.sender == forwarder`; production `expectedAuthor` check on metadata | `testFuzz_RevertWhen_ReportNotFromForwarder`, `testFuzz_AuthorCheck` |
| V2 | Look-alike business registers a colliding wallet and overwrites the fingerprint index | Collision → `VerificationRejected`, index never overwritten; rotation into a collision reverts | `test_LookalikeRegistrationRejected`, `test_RevertWhen_NewPayoutIsLookalike` |
| V3 | DNS hijack redirects payouts instantly | New controller → freeze + `changeDelay`; current controller can cancel; payout unchanged | `test_DnsControllerChangeFreezesAndDelays` |
| V4 | Hijacked session rotates payout wallet | Controller + EIP-712 approval after Agent Pass + delay; old payout can cancel | `test_PayoutChangeHappyPath`, `test_OldPayoutWalletCanCancel` |
| V5 | Approval replay / forgery / malleability | Nonce per domain, deadline, chainId + contract in domain separator, low-s check | `test_RevertWhen_ApprovalReplayed`, `testFuzz_RevertWhen_ApprovalNotFromSigner` |
| V6 | Escrow drain, double release, re-entrancy | CEI, `nonReentrant`, `open` flag, checked transfers | `test_RevertWhen_DoubleRelease`, invariants |
| V7 | Escrow timing abuse | Cancel only by sender before `releaseAt`; release only at/after | `testFuzz_RevertWhen_CancelAfterWindow`, `testFuzz_RevertWhen_ReleaseBeforeWindow`, `test_RevertWhen_NonSenderCancels` |
| V8 | Paying a frozen payee | `payByName` requires Active; `send` reverts on Frozen | `test_RevertWhen_PayFrozenPayee` |
| (+) | Decimal confusion on Arc | Only USDC ERC-20 (6 dp), never `msg.value` | code review |
| (+) | Look-alike becomes trusted after one release | Only `FirstTime` reason sets `trusted` | `test_LookalikeNeverTrusted` |

## Invariants (Foundry)
- `invariant_EscrowFullyBacked`: `USDC.balanceOf(SafeSend) == totalEscrowed == sum(open pendings)`.
- `invariant_OutNeverExceedsIn`: escrow outflow ≤ inflow; difference equals `totalEscrowed`.

## Access-control matrix
| Function | Who |
|---|---|
| `requestRegistration` | anyone (only emits / sets Pending) |
| `onReport` | CRE Forwarder (+ expected workflow owner in production) |
| `requestPayoutChange` | controller + valid backend approval |
| `executePayoutChange`, `executeControllerChange` | anyone, after delay |
| `cancelPayoutChange` | controller or current payout |
| `cancelControllerChange` | current controller |
| `payByName`, `send` | anyone (own funds) |
| `cancel` | escrow sender, before window |
| `release` | anyone, after window |

## Pre-submission checklist
- [ ] `forge test` green incl. invariants; `--fuzz-runs 1000` once
- [ ] No owner/admin/upgrade paths; no `selfdestruct`
- [ ] Forwarder address matches the environment (simulation vs production)
- [ ] `.env` gitignored; no keys in repo or logs
- [ ] Backend validates Agent Pass token server-side; client never sees signer key
- [ ] README states trust assumptions and out-of-scope

## Out of scope (declare honestly)
An attacker controlling DNS **and** the owner's World ID **and** unnoticed for the full delay; DoS by CRE freezing; funds sent outside SafeSend; fingerprint collisions at large scale.
