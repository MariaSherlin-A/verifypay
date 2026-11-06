# VerifyPay

**Address-poisoning protection and self-freezing USDC settlement on Arc.**

Live application: https://verifypay-arc.vercel.app (Arc Testnet)

## The problem

Address poisoning is one of the most common ways stablecoins are stolen. An attacker creates an address that starts and
ends with the same characters as one of your real counterparties, plants it in your transaction history with a zero-value
transfer, and waits for you to copy the wrong one. Between July 2022 and June 2024 this caused 270 million attack
transactions and $83.8 million in stolen stablecoins on Ethereum and BSC alone (Tsuchiya et al., arXiv:2501.16681).
In December 2025 a single copy-paste mistake cost one user $50 million in USDT.

Stablecoin transfers are final. There is no undo, and there is no on-chain way to know that an address really belongs to
the business you intend to pay.

## What VerifyPay does

| Situation | Outcome |
|---|---|
| Paying a business whose domain is verified | Settles instantly to the business's proven wallet |
| Paying a look-alike of a verified wallet | Held in a 10-minute undo escrow, with a warning naming the imitated business |
| Paying an address for the first time | Held in the same 10-minute undo escrow |
| Paying a business that has been frozen | Rejected by the contract |

- **Verification by Chainlink CRE.** A business proves control of its domain with a DNS TXT record. A Chainlink CRE
  workflow reads the record through two independent DNS-over-HTTPS resolvers, requires both to agree, and writes the
  result to the registry on Arc. The same workflow re-checks every business on a schedule and freezes any business whose
  proof has disappeared.
- **Undo escrow on Arc.** Risky payments wait 10 minutes in the SafeSend contract. The sender can cancel and receive
  the full amount back; after the window anyone can release the payment to the recipient.
- **Human approval with World ID.** Changing a business's payout wallet, or raising the spending limits of an AI agent's
  wallet, requires a fresh World ID approval from the same verified human, followed by a public delay that the current
  wallet can cancel.
- **A public check for builders.** Any wallet, dApp or agent can call `PayeeRegistry.inspectRecipient(address)` and
  receive Verified, Frozen, Lookalike or Unknown before sending funds.

## Sponsor tracks

| Sponsor | Track | Where to look |
|---|---|---|
| Arc | Best Smart Contracts with Advanced Stablecoin Logic | `src/`, `test/`, the app in `studio-app/` (built in Arc Studio) |
| Chainlink | Best workflow with CRE | `cre/`, [cre/README.md](cre/README.md), [docs/chainlink-cre-feedback.md](docs/chainlink-cre-feedback.md) |
| World | World ID Agent Pass | `studio-app/server/`, [docs/world-integration.md](docs/world-integration.md) |

## Evidence on Arc Testnet

| Event | Transaction |
|---|---|
| Chainlink CRE verified `pay.chrsnikhil.info` from live DNS (both resolvers agreed) | [0x4a12...0a3f](https://explorer.testnet.arc.io/tx/0x4a120ed62ec5cc0a1144ca464032e5b25ede941d93ba702e29f5c59880a40a3f) |
| Payment to a look-alike of that business was escrowed, recording the imitated wallet | [0x96c1...a90d](https://explorer.testnet.arc.io/tx/0x96c19de51db4205da8129c1582f8c8ffa7c608c4e80e54b1629441b7e3e5a90d) |
| The sender undid that payment and received the full amount | [0x404c...1c0d](https://explorer.testnet.arc.io/tx/0x404ce3057fe5e8eadbd49866c9afc33901c685257b1ddcfb6670e8a6dc3a1c0d) |
| A first-time payment was released after its window | [0x69d9...c327](https://explorer.testnet.arc.io/tx/0x69d98f8a8882af2e574e3770527b901b316eb6f25016933129f496fc676cc327) |
| A real zero-value poisoning transfer against our test payer, detected by the History shield | [0x7cd4...1f83](https://explorer.testnet.arc.io/tx/0x7cd4b77802fdcfa97ba29d82e9b6d7031aa9fc660835941baa7a7c627dca1f83) |
| Instant payment by name to the verified business | [0x504f...64a8](https://explorer.testnet.arc.io/tx/0x504ffbf258c4c0cfd833c6b3260e773984d282f3e79d080a22ad53f7a14a64a8) |

## Deployed contracts (Arc Testnet, chain 5042002)

| Contract | Address |
|---|---|
| PayeeRegistry | [0xc2035DA8766Fa4F68D405857A155dB52F15790cc](https://explorer.testnet.arc.io/address/0xc2035DA8766Fa4F68D405857A155dB52F15790cc) |
| SafeSend | [0x88E2AFe1308CA7127D1c11926Dd4879c8b8e1924](https://explorer.testnet.arc.io/address/0x88E2AFe1308CA7127D1c11926Dd4879c8b8e1924) |
| AgentWallet | [0xe905031D8C16d668282d917182D829CAc6C45358](https://explorer.testnet.arc.io/address/0xe905031D8C16d668282d917182D829CAc6C45358) |

All three are source-verified. Deployment parameters: undo window 600 s, change delay 120 s (demo value), tokens USDC
(`0x3600000000000000000000000000000000000000`) and EURC, CRE forwarder `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`.

## Repository

| Path | Contents |
|---|---|
| `src/` | Solidity contracts: PayeeRegistry, SafeSend, AgentWallet |
| `test/` | 45 Foundry tests: unit, fuzz, invariant, EIP-712 compatibility with the backend |
| `cre/` | Chainlink CRE workflow (log trigger and cron trigger) and the runner that starts it automatically |
| `studio-app/` | The web application and its backend, built in Arc Studio |
| `server/` | Reference backend (World ID Agent Pass, approval signer, history scan) |
| `agent/` | An AI agent that pays verified businesses through AgentWallet |
| `specs/` | Product and technical specifications |
| `docs/` | Security model and sponsor integration notes |

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, data flows, deployment and trust boundaries |
| [specs/01-PRD.md](specs/01-PRD.md) | Product requirements |
| [specs/02-TRD.md](specs/02-TRD.md) | Technical requirements |
| [specs/06-implementation.md](specs/06-implementation.md) | Implementation plan and status |
| [docs/security.md](docs/security.md) | Threat model, defenses and known gaps |
| [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents working in this repository |
| [AI_USAGE.md](AI_USAGE.md) | Record of what AI and the team each did, step by step |

## Running it

Hosted components:

| Component | Host |
|---|---|
| Web application | Vercel: https://verifypay-arc.vercel.app |
| Backend API | Railway: https://backend-production-f785.up.railway.app/api/config |
| Contracts | Arc Testnet |
| CRE workflow | Chainlink CRE CLI, started by `cre/runner` (see below) |

Local development:

```bash
forge test                                  # contracts
cd studio-app && bun install
bun run server                              # backend on :8787 (needs studio-app/.env)
bun run dev                                 # web application
```

CRE workflow:

```bash
cd cre/runner && npm install
node runner.mjs                             # watches registrations and runs the scheduled re-check
```

On Windows, `cre/runner/start.bat` opens the application and starts the runner in one step.

## Current status and limitations

- The CRE workflow runs through the official CRE CLI (`cre workflow simulate --broadcast`), started automatically by
  `cre/runner`. Deployment to a Chainlink DON requires deployment access, which has been requested. On testnet the
  contracts accept reports from the CRE simulation forwarder; production uses the KeystoneForwarder with an expected
  workflow owner. See [docs/security.md](docs/security.md).
- The 120-second change delay is a demonstration value. Production would use 48 hours.
- The look-alike check compares the first 4 and last 4 hex characters. Production would use wider fingerprints.

## License

MIT
