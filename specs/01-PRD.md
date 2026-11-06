# Product Requirements Document: VerifyPay

| | |
|---|---|
| Product | VerifyPay |
| Version | 1.0 (ETHGlobal Mumbai submission) |
| Network | Arc Testnet (chain 5042002) |
| Related | [02-TRD.md](02-TRD.md), [06-implementation.md](06-implementation.md), [../ARCHITECTURE.md](../ARCHITECTURE.md) |

## 1. Summary

VerifyPay prevents stablecoin payments from reaching the wrong address. Payments to a business whose domain has been
verified settle instantly. Payments to look-alike or first-time addresses are held in a 10-minute escrow that the sender
can undo. Verification is performed by a Chainlink CRE workflow that reads the business's DNS proof, and that workflow
freezes the business automatically if the proof disappears. Sensitive changes require a fresh World ID approval and a
public delay.

## 2. Problem

- **Address poisoning.** Attackers create addresses that share the first and last characters of a victim's real
  counterparty and plant them in the victim's history with zero-value or dust transfers. Between July 2022 and June 2024
  this produced 270 million attack transactions and $83.8 million in stolen stablecoins on Ethereum and BSC
  (Tsuchiya et al., arXiv:2501.16681). In December 2025 one copy-paste error cost a user $50 million in USDT.
- **Payment redirection.** Fraudsters impersonate a supplier and announce a "new wallet". Banks answer this with payee
  name checks (mandatory in the EU since October 2025). Stablecoin payments have no enforced equivalent.
- **Finality.** A stablecoin transfer cannot be reversed. There is no undo and no on-chain way to confirm that an
  address belongs to the intended business.

## 3. Goals and non-goals

**Goals**

1. A payer can pay a business by its domain name and be certain the funds reach that business's proven wallet.
2. A mistaken payment to a look-alike or unknown address can be recovered in full.
3. A business's verification stays current: if its proof disappears, payments to it stop automatically.
4. Redirecting a business's payments requires a verified human and a public, cancellable delay.
5. Any wallet, dApp or AI agent on Arc can query the same safety verdict before paying.

**Non-goals for this version**

Mainnet deployment, fiat on- and off-ramps, ENS integration, multiple chains, a mobile application, and recovery of
funds sent outside VerifyPay.

## 4. Users

| Persona | Description | Primary need |
|---|---|---|
| Payer | A finance team or individual paying businesses in USDC | Pay the right business every time, without crypto expertise |
| Business | A company receiving USDC | Customers find its real wallet; a hijacked email or domain cannot redirect funds |
| Builder | A wallet, dApp or AI agent on Arc | One call that answers "is this recipient safe to pay?" |

## 5. User stories

| ID | Persona | Story | Priority |
|---|---|---|---|
| US-1 | Payer | Pay a business by its domain and have it settle instantly to the verified wallet | Must |
| US-2 | Payer | When I paste a look-alike address, see which business it imitates and have the payment held | Must |
| US-3 | Payer | Undo a held payment within 10 minutes and receive the full amount back | Must |
| US-4 | Business | Register my domain by publishing a DNS TXT record and be verified by Chainlink CRE | Must |
| US-5 | Business | If my DNS proof disappears, be frozen automatically so nobody pays a stale wallet | Must |
| US-6 | Business | Change my payout wallet only after a fresh World ID approval and a public delay my current wallet can cancel | Must |
| US-7 | Builder | Call one view function to get Verified, Frozen, Lookalike or Unknown for any address | Must |
| US-8 | Payer | Have a first-time recipient held once, and paid directly after one completed payment | Should |
| US-9 | Payer | See poisoning attempts in my history, including zero-value transfers | Should |
| US-10 | Payer | See every payment I made through VerifyPay, with its outcome | Should |
| US-11 | Payer | Pay in USDC or EURC | Should |
| US-12 | Business, Builder | Give an AI agent a wallet that can pay only verified businesses within limits; raising limits needs World ID | Should |
| US-13 | Business | Prove a legal entity identifier (LEI) checked against GLEIF | Could |

## 6. Functional requirements

| ID | Requirement | Story |
|---|---|---|
| FR-1 | `requestRegistration(domain)` validates the domain, stores it as Pending and emits `RegistrationRequested` | US-4 |
| FR-2 | The CRE workflow reads TXT `_verifypay.<domain>` from two independent DNS-over-HTTPS resolvers; both must return the same `arc:<address>` | US-4 |
| FR-3 | On a valid proof the workflow writes VERIFY through the CRE forwarder; the registry sets controller and payout and marks the business Active | US-4 |
| FR-4 | A scheduled run re-checks every business and writes FREEZE when the record is missing or no longer matches | US-5 |
| FR-5 | A VERIFY naming a different controller freezes the business and queues the new controller behind `changeDelay`; the current controller can cancel | US-5 |
| FR-6 | `payByName` pays only Active businesses, in one transfer, without escrow | US-1 |
| FR-7 | `send` pays verified and trusted recipients directly, holds first-time and look-alike recipients in escrow, and rejects frozen businesses | US-2, US-8 |
| FR-8 | `cancel(id)` by the sender before the window ends refunds the full amount; `release(id)` by anyone afterwards pays the recipient | US-3 |
| FR-9 | `requestPayoutChange` requires the controller and an EIP-712 approval that the backend issues only after a validated World ID approval | US-6 |
| FR-10 | `executePayoutChange` succeeds only after `changeDelay`; the controller or current payout wallet can cancel before then | US-6 |
| FR-11 | `inspectRecipient(address)` returns the verdict, the domain hash and the imitated wallet | US-7 |
| FR-12 | The registry refuses any payout wallet whose fingerprint collides with an existing payout wallet | US-2 |
| FR-13 | The history scan reports incoming transfers, including zero-value transfers, from look-alikes of addresses the user has paid | US-9 |
| FR-14 | The application lists the user's payments from on-chain `Paid` and `Escrowed` events with explorer links | US-10 |
| FR-15 | SafeSend accepts only USDC and EURC, fixed at deployment | US-11 |
| FR-16 | `AgentWallet.agentPay` pays only Active businesses, within per-payment and per-day limits that start at zero, and only while not paused | US-12 |
| FR-17 | `AgentWallet.raiseLimits` requires a World ID-backed EIP-712 approval; lowering limits and pausing need none | US-12 |
| FR-18 | The backend binds each business and agent wallet to the first World ID subject that approves for it and refuses approvals from a different subject | US-6, US-12 |
| FR-19 | When a `lei:` record is published, the workflow requires GLEIF to report the LEI as issued and active | US-13 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Safety | Every function that moves funds is non-reentrant, uses checked token calls and emits an event |
| Authority | No administrator can move funds, unfreeze a business or bypass a delay |
| Integrity | Sponsor integrations (Arc, Chainlink CRE, World ID) are real in the main flow; test doubles exist only in tests |
| Secrets | Private keys and client secrets exist only in server environments, never in the client or the repository |
| Responsiveness | Verdicts appear within 2 seconds of input, excluding block confirmation |
| Transparency | Every decision (verify, freeze, escrow, undo, release) is visible as an on-chain event |

## 8. Success criteria

1. On Arc Testnet: a verified payment, an escrowed look-alike payment, an undo, a release and a CRE verification, each
   with an explorer link.
2. A CRE freeze written after the business's DNS record is removed.
3. A World ID approval that leads to a signed approval, and a refusal without one.
4. All contract tests pass, including fuzz and invariant tests.

## 9. Out of scope and future work

- Deployment of the CRE workflow to a Chainlink DON (pending access) with the production forwarder and workflow owner.
- Longer change delay (48 hours) and wider address fingerprints for production.
- Gasless approvals (EIP-2612 or EIP-3009), embedded wallets for payers, and alerts when a business freezes.
