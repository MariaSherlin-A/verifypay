# 01 · PRD

## Personas
- **P1 Payer (Riya, finance lead):** pays 30 vendors in USDC monthly; copies addresses from history.
- **P2 Business owner (Acme):** publishes its payout wallet; fears a hijacked email or domain.
- **P3 Builder:** a wallet or AI agent on Arc that wants a pre-payment safety check.

## User stories (MoSCoW)
**Must**
- US-1 (P1) Pay a business by its domain name and have it settle instantly to the verified wallet.
- US-2 (P1) When I paste a look-alike address, see who it imitates and have the payment escrowed.
- US-3 (P1) Undo an escrowed payment within 10 minutes and get 100% back.
- US-4 (P2) Register my domain by publishing a DNS TXT record; get verified by Chainlink CRE.
- US-5 (P2) If my DNS proof disappears, have my payee frozen automatically so nobody pays a stale wallet.
- US-6 (P2) Change my payout wallet only after a fresh World ID Agent Pass check and a public delay; my old wallet can cancel.
- US-7 (P3) Call one view function to get Verified / Frozen / Lookalike / Unknown for any recipient.

**Should**
- US-8 (P1) First-time unverified recipients are escrowed once; after one released payment they are trusted.
- US-9 (P1) See my recent incoming dust/zero-value transfers flagged as poisoning attempts (history scan).
- US-10 (P2) Optional LEI proof checked against GLEIF.

- US-13 (P1) Pay in USDC or EURC.
- US-14 (P2/P3) Give an AI agent a wallet that can pay only verified businesses by domain, within per-payment and daily caps; raising caps needs a fresh World ID Agent Pass.

**Could**
- US-11 Circle Wallets (no-extension sign-in) for payers.
- US-12 Webhook alerts when a payee freezes or a wallet change is queued.

**Won't (this hackathon)**
- Mainnet, fiat ramps, ENS, multi-chain, mobile app, recovering funds already sent outside SafeSend.

## Functional requirements
| ID | Requirement | Story |
|---|---|---|
| FR-1 | `requestRegistration(domain)` validates lowercase domain, stores it, emits `RegistrationRequested` | US-4 |
| FR-2 | CRE log trigger reads TXT `_verifypay.<domain>` from Google and Cloudflare DoH; both must agree on `arc:<address>` | US-4 |
| FR-3 | CRE writes `ACTION_VERIFY` via the Forwarder; registry sets controller + payout, status Active | US-4 |
| FR-4 | CRE cron re-checks every payee; missing/mismatched record or lapsed LEI writes `ACTION_FREEZE` | US-5 |
| FR-5 | A verify report naming a different controller freezes the payee and queues the new controller behind `changeDelay`; current controller can cancel | US-5 |
| FR-6 | `payByName` pays only Active payees, in USDC, one transfer, no escrow | US-1 |
| FR-7 | `send(to)` pays Verified directly; Frozen reverts; Lookalike and first-time Unknown go to escrow | US-2, US-8 |
| FR-8 | `cancel(id)` by sender before `releaseAt`; `release(id)` by anyone after | US-3 |
| FR-9 | `requestPayoutChange` needs controller + EIP-712 approval from the backend signer, issued only after a validated Agent Pass result | US-6 |
| FR-10 | `executePayoutChange` after `changeDelay`; `cancelPayoutChange` by controller or current payout | US-6 |
| FR-11 | `inspectRecipient(address)` returns verdict, domainHash, imitated wallet | US-7 |
| FR-12 | Registry rejects any wallet whose fingerprint (first 4 + last 4 hex) collides with a registered payout | US-2 |
| FR-13 | Backend history scan flags incoming zero/dust transfers from look-alikes of the payer's past recipients | US-9 |
| FR-14 | Backend Agent Pass: request, completion, server-side token validation, denied/expired/cancelled paths | US-6 |
| FR-15 | SafeSend accepts only USDC and EURC (allowlist fixed at deploy); escrow accounting per token | US-13 |
| FR-16 | `AgentWallet.agentPay(token, domainHash, amount, ref)`: agent only, Active payee only, per-payment + per-day caps, pause | US-14 |
| FR-17 | `AgentWallet.raiseLimits` requires an EIP-712 approval issued only after Agent Pass; `lowerLimits` needs none | US-14 |
| FR-18 | Backend binds each payee/wallet to the first World ID (`sub`) that approves; later approvals from a different human are rejected | US-6, US-14 |

## Non-functional
- Every USDC movement: one transaction, nonReentrant, event emitted.
- Demo path works on Arc Testnet with real testnet USDC; no mocks in the main flow.
- p95 UI response under 2s excluding chain confirmation.

## Demo success metrics
- 4 on-chain tx shown on the explorer: escrow, undo, CRE verify, CRE freeze.
- One Agent Pass denial and one approval shown live.
- `forge test` green on screen (45 tests incl. invariants).

## Explicit scope cuts
ENS, mainnet, Circle Wallets (if behind), webhooks, GLEIF (if behind).
