# Building VerifyPay in Arc Studio: complete step-by-step guide

Arc's rules for every Arc prize: **Arc Studio is the starting point**, a **shareable Studio project URL**, **Studio shown in the demo**,
a **working frontend + backend**, and an **architecture diagram**. This guide gets you there with **real integrations only**.

Links: Studio https://studio.arc.io · Circle Console https://console.circle.com (Testnet) · Faucet https://faucet.circle.com ·
Arc docs https://docs.arc.io · CRE docs https://docs.chain.link/cre · World https://auth.world.org/docs

## The "no mocks" rule (paste-able, used in every prompt below)
```
RULES FOR THIS PROJECT (apply to every change):
- Real integrations only. No mock data, placeholder values, fake fallbacks, "demo mode" switches, hard-coded sample results or simulated responses anywhere in the app or backend.
- If a contract call, backend call, World ID call or explorer call fails, show the real error to the user. Never substitute fake data.
- Contracts in src/ are final and tested. Do NOT modify, rewrite, rename or redeploy them unless I explicitly ask.
- Use exactly the contract function names, event names, ABIs and addresses I give you. Do not invent functions or endpoints.
- USDC 0x3600000000000000000000000000000000000000 and EURC 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a are ERC-20s with 6 decimals. Never use msg.value or 18-decimal native amounts for payments.
- Secrets (private keys, client secrets) are server-side environment variables only. Never put them in frontend code, logs or the chat.
- The files in server/ and web/ are the reference implementation: match their logic exactly.
```

### What is real, and where it comes from (verified Nov 6 2026)
| Integration | Real source | Verified |
|---|---|---|
| Chain | Arc Testnet, chain id 5042002, RPC `https://rpc.testnet.arc.io` | `eth_chainId` = `0x4cef52` |
| Stablecoins | USDC `0x3600…0000`, EURC `0x89B5…D72a` (6 decimals) | EURC bytecode on-chain |
| Explorer API (History shield) | Blockscout v2 at `https://explorer.testnet.arc.io/api/v2` | `/api/v2/stats` → 200 |
| Chainlink CRE | CRE CLI `simulate --broadcast` → Chainlink's simulation forwarder `0x6E9E…eDc1` → real `onReport` tx on Arc | forwarder bytecode on-chain |
| DNS proof | Your real domain's TXT record, read via `dns.google` + `cloudflare-dns.com` | – |
| World ID Agent Pass | `https://auth.world.org` OIDC: `device_authorization_endpoint`, RS256 ID tokens with `auth_time` | discovery document |

Notes for judges (say these honestly):
- Chainlink's prize accepts "a successful simulation (CRE CLI) or deployment". `simulate --broadcast` runs the real workflow,
  fetches real DNS/GLEIF data and writes a **real transaction** on Arc through Chainlink's own simulation forwarder. If you get
  CRE deploy access, see Step 8.4 for the production forwarder.
- World mocks the identity *proofs* at this event (their prize page says so). Our integration with `auth.world.org` is still the real one.

---

## PART A · On your laptop, before Studio (≈ 45 min)

### A1. Get a real domain you control (required)
CRE verification reads a DNS TXT record, so you need a domain (or subdomain) whose DNS you can edit, e.g. a cheap domain on
Cloudflare/Namecheap, or a subdomain like `pay.yourname.dev`. Cloudflare DNS is fastest to propagate.
Domain must be lowercase `a-z 0-9 - .` with at least one dot (the contract rejects anything else).

### A2. Prepare wallets (no keys in GitHub, Studio chat, or screenshots)
| Wallet | What for | How |
|---|---|---|
| **Payer** | Your browser wallet (MetaMask/Rabby); pays, undoes | existing; also the AgentWallet **owner** |
| **Business ("Acme")** | Controller + first payout of your domain; its address goes in the TXT record | 2nd account in your browser wallet |
| **Approval signer** | Backend key that signs EIP-712 approvals after World ID | generate below; ADDRESS → contracts, KEY → backend env |
| **CRE key** | Pays gas for CRE `--broadcast` writes | generate below; `cre/.env` only |
| **Agent** | The AI agent's own key | generate below; Studio agent secret / `AGENT_KEY` |
| **Attacker** | Plants a real poisoning transfer for the History shield demo | 3rd account in your browser wallet |

Generate keys locally (prints `privateKey address`; store them in a password manager):
```
cd server && npm i
node -e "import('viem/accounts').then(({generatePrivateKey:g,privateKeyToAccount:a})=>{for(const n of ['signer','cre','agent']){const k=g();console.log(n,k,a(k).address)}})"
```
Fund Payer, Business, CRE key and Agent with Arc Testnet USDC (Studio sidebar **Get test USDC**, or https://faucet.circle.com → Arc Testnet). Get EURC for the Payer if offered.

### A3. Publish the DNS record now (propagation takes time)
At your DNS provider add:
```
Name:  _verifypay.<your-domain>        Type: TXT        Value: arc:<BUSINESS wallet address>
```
Check: `nslookup -type=TXT _verifypay.<your-domain> 8.8.8.8` and `... 1.1.1.1` both show it.

### A4. Make the repo importable and push it to GitHub
The repo root must be the **`verifypay 2`** folder (README.md at the top level). In Git Bash:
```
cd "/d/Downloads/VerifyPay-complete/verifypay 2"
rm -f ziKB0MdE                                   # old zip snapshot of this repo; not part of the project
git init -b main
git submodule add --force https://github.com/foundry-rs/forge-std lib/forge-std
git -C lib/forge-std checkout v1.17.0
git add -A
git status                                       # confirm: NO .env files, NO keys, docs/ IS included
git commit -m "VerifyPay: contracts, tests, CRE workflow, backend, web app, specs"
git remote add origin https://github.com/MariaSherlin-A/verifypay.git
git push -u origin main
```
The repo must be **public** (ETHGlobal rule). From here on, **commit after every step** below (judges check history).

---

## PART B · In Arc Studio

### Step 0 · Sidebar setup (2 min)
1. Click **Get a usage limit increase** now.
2. Click **Get test USDC** (top up the wallets from A2 if needed).
3. Circle Console (Testnet) → **Keys**: create an API key only if you will use Circle Wallets (optional, Step 6.8).

### Step 1 · Import the repo (**From GitHub**)
Studio clones only into an active sandbox ("No active sandbox for this app. Start a chat to provision a sandbox before cloning").
1. **New project** → in the "What should we build?" box send a first message to provision the sandbox:
   ```
   I'm going to import my GitHub repo MariaSherlin-A/verifypay into this project. Don't generate any code yet; just wait.
   ```
2. When the sandbox is ready, open the GitHub dialog (**From GitHub** / + → GitHub), pick **MariaSherlin-A/verifypay** →
   **Clone into current project**. (The dialog says "Files land beside `src/` in your sandbox".)
3. Then send:
```
First show me the sandbox file tree (2 levels). My repo must sit at the Foundry project root: foundry.toml, src/,
test/, script/, lib/forge-std, cre/, server/, web/, agent/, specs/, docs/. If the sandbox already had its own src/
or template files, tell me which files conflict before touching anything; my repo's files win.
```
4. Then send:
```
This repo is VerifyPay: an address-poisoning interceptor and self-freezing USDC settlement layer on Arc.
Read these files first, fully: README.md, CLAUDE.md, ARC_STUDIO_BUILD.md, specs/00-idea.md, specs/02-TRD.md,
specs/03-security.md, specs/04-backend-core.md, specs/05-uiux.md.

<paste the RULES FOR THIS PROJECT block from ARC_STUDIO_BUILD.md here>

Task now: compile the contracts in src/ (PayeeRegistry, SafeSend, AgentWallet) with solc 0.8.28 (see foundry.toml)
and run the Foundry tests in test/. If lib/forge-std is missing, run `forge install foundry-rs/forge-std@v1.17.0`.
Show me the full test output. Do not change any file.
```
Expected: **45 tests pass** (unit, fuzz, 2 invariants, 2 EIP-712 compatibility).
**Copy the Studio project URL into README.md** (line "Studio project URL"), commit.

### Step 2 · Deploy to Arc Testnet
```
Deploy the contracts from src/ to Arc Testnet (chain id 5042002, RPC https://rpc.testnet.arc.io) in this exact order
with exactly these constructor arguments. Do not modify the contracts.

1. PayeeRegistry(
     _forwarder      = 0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1,   // Chainlink CRE forwarder used by `cre workflow simulate --broadcast` on Arc Testnet
     _expectedAuthor = 0x0000000000000000000000000000000000000000,   // workflow-owner check off while we use CRE simulation
     _approvalSigner = <APPROVAL SIGNER ADDRESS>,
     _changeDelay    = 120)                                          // 2 minutes for the demo (48h in production)
2. SafeSend(
     _registry   = <PayeeRegistry address from 1>,
     _tokens     = [0x3600000000000000000000000000000000000000, 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a],
     _undoWindow = 600)                                              // 10 minutes
3. AgentWallet(
     _registry       = <PayeeRegistry address from 1>,
     _owner          = <MY PAYER WALLET ADDRESS>,
     _agent          = <AGENT ADDRESS>,
     _approvalSigner = <APPROVAL SIGNER ADDRESS>)

After deploying: verify all three on the Arc explorer (https://explorer.testnet.arc.io), then read back and show me
PayeeRegistry.forwarder(), approvalSigner(), changeDelay(), SafeSend.undoWindow(), SafeSend.supportedToken(USDC) and
SafeSend.supportedToken(EURC), AgentWallet.owner() and agent(). Give me the three addresses and explorer links.
```
Expected result: Check every read-back value. Put the addresses in README.md ("Contracts" section) and in `server/.env` locally; commit.

### Step 3 · Backend (first prompt in **Build an app**, same project)
```
<RULES block>

Build the backend for the VerifyPay web app by porting server/src/server.js, server/src/oidc.js,
server/src/approval.js and server/src/poisoning.js into this app's backend. Keep the logic identical
(including validateIdToken, the device flow, the same-human binding and the EIP-712 types). Routes:

GET  /api/config              -> { chainId:5042002, rpcUrl, explorer, registry, safeSend, agentWallet, usdc, eurc, approvalSigner }
POST /api/agent-pass/start    body {action:'payoutChange'|'raiseLimits', params} -> World ID device authorization
POST /api/agent-pass/poll     body {sessionId} -> pending | denied | expired | rejected | approved {signature, deadline, nonce}
GET  /api/history-scan?address=0x… -> Blockscout v2 https://explorer.testnet.arc.io/api/v2/addresses/{a}/token-transfers?type=ERC-20, then scanHistory()

Server-side environment variables (I will set the values myself, do not invent them):
REGISTRY_ADDRESS=<addr> SAFESEND_ADDRESS=<addr> AGENT_WALLET_ADDRESS=<addr>
USDC_ADDRESS=0x3600000000000000000000000000000000000000 EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
ARC_RPC_URL=https://rpc.testnet.arc.io ARC_EXPLORER_URL=https://explorer.testnet.arc.io CHAIN_ID=5042002
APPROVAL_SIGNER_KEY (secret) APPROVAL_TTL_SECONDS=600
WORLD_ISSUER=https://auth.world.org WORLD_CLIENT_ID WORLD_CLIENT_SECRET (secret, may be empty) WORLD_SCOPE=openid

The same-human binding (first World ID `sub` that approves a payee/wallet owns it) must be stored persistently
(a file or this platform's key-value store), not only in memory. Also port the 13 tests in server/test/ and run them.
Tell me where in Studio I set server-side secrets.
```
Then set the env vars in Studio's secrets/environment UI (**never paste keys into the chat**).
Expected result: `GET /api/config` returns your real addresses and `approvalSigner` equals the address you deployed with.
If Studio cannot store server secrets, ask it how; as a last resort run `server/` locally (`npm start`) and point the app at it.

### Step 4 · World ID Agent Pass app registration (5 min, do this while Studio builds)
1. https://auth.world.org/portal → create an app; copy the **client id** (and secret if issued).
2. Put them in Studio's backend env (`WORLD_CLIENT_ID`, `WORLD_CLIENT_SECRET`).
3. The backend uses the **device flow**; World's discovery document lists `device_authorization_endpoint` (checked Nov 6).
4. Start writing `docs/world-debrief.md` (time to first success, friction).

### Step 5 · Wallet connection (prompt)
```
<RULES block>
Frontend wallet connection: use an injected wallet (MetaMask/Rabby) with viem. On connect, switch to Arc Testnet
(chain id 5042002); if the wallet doesn't know it, add it (RPC https://rpc.testnet.arc.io, explorer
https://explorer.testnet.arc.io, native currency USDC with 18 decimals for gas display only).
Read all addresses from GET /api/config, never hard-code them in the frontend.
Every transaction: wait for the receipt, show an explorer link, and show decoded custom errors
(PayeeNotActive, PayeeFrozen, WindowOver, WindowOpen, NotSender, NotOpen, UnsupportedToken, NotController,
NotActive, BadSignature, Expired, LookalikeCollision, PayoutInUse, TooEarly, NotAuthorized, OverPerPayment, OverDaily).
Reference: web/app.js (connect handler and write()).
```

### Step 6 · Screens (one prompt each; test each on testnet before the next)
**6.1 Pay**
```
<RULES block>
Build the Pay screen exactly like web/app.js "Pay" section. Headline: "Pay the business, not the address".
One input accepting a domain (acme.com) or a 0x address, a USDC/EURC selector, an amount.
- Domain: PayeeRegistry.resolve(keccak256(domain)) -> (payout, status). status 2 = green "Verified · settles instantly";
  3 = grey "Frozen: verification lapsed, payments blocked" (disable Pay); 0/1 = amber "Not a verified business" (disable Pay).
- Address: PayeeRegistry.inspectRecipient(address) -> (verdict, domainHash, imitated).
  1 Verified = green, direct. 2 Frozen = grey, disable Pay.
  3 Lookalike = big red banner "Look-alike of <getPayee(domainHash).domain>. Likely address poisoning." and render the
    pasted address with every character that differs from `imitated` highlighted, plus the real payee address under it.
  0 Unknown = amber "First payment to this address: it waits 10 minutes with Undo".
- Button label: "Pay now" when instant, otherwise "Send with 10-minute undo".
- Before paying: if ERC20.allowance(me, SafeSend) < amount, call approve(SafeSend, amount) and explain why.
- Domain -> SafeSend.payByName(token, domainHash, amount, ref). Address -> SafeSend.send(token, to, amount, ref).
  amount = parseUnits(input, 6). ref = keccak256 of a unique string.
- Decode the Escrowed event from the receipt; if present, store the escrow id and link to the Undo window.
Verdict chip uses icon + text (not colour only) and aria-live="polite"; buttons at least 44px tall.
```
**6.2 Undo window**
```
<RULES block>
Build the Undo window like web/app.js "Undo window", with one improvement: load my escrows from chain, not only
localStorage: query SafeSend `Escrowed` logs where sender = my address (event Escrowed(uint256 indexed id, address token,
address indexed sender, address indexed to, uint256 amount, uint8 reason, address imitated, uint64 releaseAt, bytes32 ref)),
then read SafeSend.pendings(id) for each.
Each card: amount + token, recipient, reason (0 first-time, 1 look-alike), live countdown to releaseAt computed from
the latest block timestamp (chain time, not the local clock). Before releaseAt and I am the sender: big "Undo" button ->
SafeSend.cancel(id). After releaseAt and still open: "Release to recipient" -> SafeSend.release(id). Closed: "Settled".
Empty state: "No held payments".
```
**6.3 History shield**
```
<RULES block>
Build the History shield screen like web/app.js: button "Scan my history" -> GET /api/history-scan?address=<me>.
For each attempt show a red card "Poisoning attempt · Never copy from this row", the poisoned address with differing
characters highlighted against `imitates`, and the explorer link of txHash. Otherwise show
"No poisoning attempts found across N real counterparties". Show backend errors as errors.
```
**6.4 Business**
```
<RULES block>
Build the Business screen like web/app.js "Business":
1. Domain input; show the exact TXT record `_verifypay.<domain>  TXT  "arc:<connected address>"` with a Copy button.
2. "Request verification" -> PayeeRegistry.requestRegistration(domain); show the tx link and the text
   "Chainlink CRE will verify your DNS record".
3. Status from PayeeRegistry.getPayee(keccak256(domain)): None/Pending/Active/Frozen, payout, verifiedAt; if
   pendingController != 0 show a warning "DNS now points to <addr>; it can take over at <controllerEta> unless you cancel"
   with a Cancel button (cancelControllerChange, current controller only).
4. "Change payout wallet": new payout input; button "Verify with World ID" ->
   POST /api/agent-pass/start {action:"payoutChange", params:{domainHash, newPayout}}; show the verification link
   (verificationUriComplete or verificationUri) as a link AND a QR code, plus the user code; poll
   POST /api/agent-pass/poll {sessionId} every `interval` seconds.
   approved -> PayeeRegistry.requestPayoutChange(domainHash, newPayout, deadline, signature).
   denied / expired / rejected -> "Not approved. Nothing changed." and send NO transaction.
5. Pending payout change: countdown to payoutEta, "Execute change" (enabled after payoutEta, executePayoutChange) and
   "Cancel (old wallet)" (cancelPayoutChange). Payments keep going to the old wallet until execution.
```
**6.5 Agent wallet**
```
<RULES block>
Build the Agent wallet screen like web/app.js "Agent wallet": read AgentWallet limits(token), spentToday(token), agent(),
owner(), paused() and the token balance of the AgentWallet. "Raise limits" (per payment, per day, 6 decimals) uses the
same World ID flow with action "raiseLimits", params {wallet, token, perPayment, perDay} (atomic units as strings), then
AgentWallet.raiseLimits(token, perPayment, perDay, deadline, signature) from the owner wallet. Also add owner-only
"Lower limits" (lowerLimits, no World ID), "Pause/Unpause" (setPaused) and "Fund agent wallet" (ERC20 transfer to it).
```
**6.6 Architecture page (required by Arc)**
```
Add an "Architecture" page that renders the Mermaid diagram from specs/02-TRD.md, the World flow diagram from
docs/world-integration.md, and lists PayeeRegistry, SafeSend and AgentWallet with explorer links, plus the
Chainlink forwarder, USDC and EURC addresses.
```
**6.7 Builders page**
```
Add a "Builders" page showing how any wallet or agent can call PayeeRegistry.inspectRecipient(address) before paying
(a short viem code snippet with our real registry address) and a live input that runs it.
```
**6.8 (optional) Circle Wallets**: only if Studio offers it natively and time allows; keep the injected wallet working.

Commit (or sync Studio → GitHub) after each screen. If Studio edits code, make sure the GitHub repo receives those changes
(ask Studio: "push these changes to the connected GitHub repo"), so GitHub, Studio and the demo match.

### Step 7 · The agent (**Build an agent**)
```
<RULES block>
Build an agent with its own Arc Testnet key (secret AGENT_KEY; address <AGENT ADDRESS>) that pays verified businesses
for API calls. Reference implementation: agent/agent-pay.mjs.
- It may ONLY call AgentWallet.agentPay(token, keccak256(domain), amount, ref) on <AgentWallet address>. It never pays a raw address.
- Before paying, read PayeeRegistry.resolve(keccak256(domain)); if status != 2 (Active), stop and report
  "refused: <domain> is not a verified business".
- Simulate the call first; on OverPerPayment / OverDaily / IsPaused / PayeeNotActive, stop and report the decoded error.
  Never retry and never fall back to another payment method.
- Log every payment with amount, token, domain and the explorer link.
Input: "pay <domain> <amount> [usdc|eurc]".
```
Then, from the owner wallet: fund the AgentWallet with USDC (transfer), and raise its limits on the Agent wallet screen
(limits start at **0**, so the first raise already needs World ID: good for the demo). `setAgent(<agent>)` only if the agent changed.

### Step 8 · Chainlink CRE (from your laptop; Studio has no CRE runtime)
```
# 8.0 one time: create an account at https://cre.chain.link, install the CRE CLI (docs.chain.link/cre), then
cre login
# 8.1 bindings + types
cd cre && cre generate-bindings evm
cd contracts && npm i && cd ..
cd verifypay-workflow && npm i && npm run typecheck && cd ..
# 8.2 config (never commit .env)
#   verifypay-workflow/config.staging.json -> "registryAddress": "<PayeeRegistry>"
#   cre/.env -> CRE_ETH_PRIVATE_KEY=<CRE key from A2, funded with Arc USDC>
```
If `typecheck` reports `Cannot find name 'Buffer'`, replace both `Buffer.from(res.body).toString('utf-8')` in
`workflow.ts` with `new TextDecoder().decode(res.body)`, re-run typecheck, and commit.

**8.3 VERIFY (real DNS → real tx).** Business screen → Request verification for your domain (from the Business wallet) → copy the tx hash:
```
cre workflow simulate verifypay-workflow --target staging-settings --broadcast \
  --non-interactive --trigger-index 0 --evm-tx-hash <requestRegistration tx hash> --evm-event-index 0
```
Expected result: Log shows both resolvers returning your `arc:` address and `action=1 … tx=0x…`; Business screen shows **Active**.
**FREEZE.** Delete the TXT record, wait until `nslookup` at 8.8.8.8 and 1.1.1.1 no longer shows it, then:
```
cre workflow simulate verifypay-workflow --target staging-settings --broadcast --non-interactive --trigger-index 1
```
Expected result: `action=2` tx; Business shows **Frozen**; Pay "<domain>" is blocked; the agent is refused.
**Re-verify:** restore the TXT record, run trigger 1 again → Active.
Save both explorer links + terminal output in `docs/chainlink-cre-feedback.md` (Evidence) and fill the rest of it.

**8.4 (optional) Production CRE.** Only if you have CRE deployment access: deploy the workflow with `cre workflow deploy`,
deploy a second PayeeRegistry with forwarder `0x76c9cf548b4179F8901cda1f8623568b58215E62` and `expectedAuthor` = your workflow
owner address (confirm both in the Chainlink forwarder directory), and point the app at it.

### Step 9 · End-to-end live test (real money flows, in this order)
1. **Pay by name**: Payer pays `<your-domain>` 1 USDC → one tx, Business balance +1.
2. **Poisoned address → escrow → Undo**: build a look-alike of the Business address by keeping its first 4 and last 4 hex
   characters and changing the middle (any address can receive; no key needed). Paste it → red banner → send 1 USDC →
   Undo window → **Undo** → balance restored. Do it once more and let it **Release** after 10 minutes.
3. **Real poisoning for the History shield** (the exact technique attackers use): from the Attacker account call
   `USDC.transferFrom(<Payer>, <look-alike>, 0)` (zero-value transfer that appears in the Payer's history as "sent by you").
   If Arc's USDC rejects a zero-value transferFrom, generate a real key for a look-alike instead
   (`cast wallet vanity --starts-with <first4> --ends-with <last4>`, can take a while) and send 0.001 USDC from it to the Payer.
   Then **Scan my history** → the attempt is flagged.
4. **CRE freeze / re-verify** (Step 8.3).
5. **World ID**: Business → change payout → in World App **Deny** → "Nothing changed", no tx. Again → **Approve** →
   `requestPayoutChange` tx → 2:00 countdown → Payer still pays the old wallet → Cancel from old wallet (or Execute).
6. **Agent**: raise limits via World ID → agent pays `<your-domain>` → freeze the domain → agent refused → over-cap amount refused.

### Step 10 · Submission evidence
- README: Studio project URL, the three contract addresses, explorer links for: payByName, escrow, undo, release,
  CRE VERIFY, CRE FREEZE, requestPayoutChange, agentPay.
- Bounty name in the form: **"Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio"**.
- Video (≤ 3 min, script in specs/08-demo-submission.md): include 15–20 s of Studio (project, a prompt, the deploy panel).
- Circle tools used: Arc Studio, USDC + EURC on Arc, Circle faucet / Console (+ Circle Wallets if used).
- Fill `docs/world-debrief.md` and `docs/chainlink-cre-feedback.md`; update `AI_USAGE.md` (Studio counts as AI); tick
  SPONSOR_QUALIFICATION.md. Final commit before **Sun 07:00 IST**.

## Usage tips
- One prompt per feature; paste exact addresses and function names (Studio guesses less).
- After every Studio change, ask: "List every file you changed and confirm you did not add mock data or modify src/."
- If Studio proposes changing a contract, refuse unless a failing test proves a bug; specs/ is the source of truth.
- If Studio struggles, point it at the reference: "Implement this exactly like web/app.js, the Undo window section."
