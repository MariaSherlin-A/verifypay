# Building VerifyPay in Arc Studio (step by step)

Arc's rules: every Arc prize must use **Arc Studio as the starting point**, include a **shareable Studio project URL**, show **Studio in the demo**, and have a **working frontend + backend + architecture diagram**.
So: the contracts in `src/` are already written and tested (44 Foundry tests). **Arc Studio deploys them and builds the app, backend and agent around them.**

Links: Studio https://studio.arc.io · Console https://console.circle.com (Testnet) · Docs https://developers.circle.com · Arc docs https://docs.arc.io

---

## Step 0 · Before you start (5 min)
1. In Studio's sidebar, click **Get a usage limit increase** now (you will need it).
2. Click **Get test USDC** for your deployer wallet (or https://faucet.circle.com → Arc Testnet). Get some EURC too if offered.
3. In Circle Console (Testnet) → **Keys**: create an API key (for Circle Wallets, if you use them).
4. Push this repo to a **public GitHub repo** first (`git init && git add -A && git commit && git push`).
5. Generate a fresh **approval signer** key for the backend (e.g. `cast wallet new`). Its ADDRESS goes into the contracts; its private key only into the backend `.env`.

## Step 1 · Import the repo ("From GitHub")
On the Studio home screen click **From GitHub**, pick your repo, then paste:

```
This repo is VerifyPay, an address-poisoning interceptor and self-freezing USDC settlement layer on Arc.
Read README.md, CLAUDE.md and specs/ first. The contracts in src/ (PayeeRegistry, SafeSend, AgentWallet)
are final and tested: do NOT rewrite them. Compile them and run the Foundry tests in test/ and show me the result.
```
Expected: 44 tests pass. **Save the Studio project URL into README.md now** (needed for submission).

> If "From GitHub" fails: use **Write a contract**, paste `src/PayeeRegistry.sol`, then `src/SafeSend.sol`, then `src/AgentWallet.sol` with the prompt "Use this contract exactly as written; compile and test it."

## Step 2 · Deploy on Arc Testnet
```
Deploy to Arc Testnet (chain 5042002), in this order, using exactly these constructor arguments:
1. PayeeRegistry(
     forwarder      = 0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1,   // Chainlink CRE MockKeystoneForwarder on Arc Testnet
     expectedAuthor = 0x0000000000000000000000000000000000000000,   // 0 while we use CRE simulation
     approvalSigner = <OUR APPROVAL SIGNER ADDRESS>,
     changeDelay    = 120)                                          // 2 minutes for the demo
2. SafeSend(
     registry   = <PayeeRegistry address>,
     tokens     = [0x3600000000000000000000000000000000000000, 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a],  // USDC, EURC (6 decimals)
     undoWindow = 600)                                              // 10 minutes
3. AgentWallet(
     registry       = <PayeeRegistry address>,
     owner          = <my wallet>,
     agent          = <the agent wallet address Studio creates in Step 5, or my wallet for now>,
     approvalSigner = <OUR APPROVAL SIGNER ADDRESS>)
Verify all three on the Arc explorer and give me the addresses and explorer links.
```
Write the three addresses into README.md and `server/.env` (see `server/.env.example`).

## Step 3 · Build the app ("Build an app" inside the same project)
Paste this as one prompt (Studio builds the frontend and backend together):

```
Build a mobile-first web app for VerifyPay on Arc Testnet using the deployed contracts
(PayeeRegistry <addr>, SafeSend <addr>, AgentWallet <addr>; USDC 0x3600000000000000000000000000000000000000,
EURC 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a, both 6 decimals; never use native msg.value).
A non-crypto user must understand every screen. Lead the copy with address poisoning, not "payee verification".

Screens:
1. Pay: one field accepting a domain (acme.com) or an address, plus a USDC/EURC selector and amount.
   - Domain: call PayeeRegistry.resolve(keccak256(domain)). Status 2 = green "Verified, settles instantly"; 3 = grey "Frozen, payments blocked".
   - Address: call PayeeRegistry.inspectRecipient(address) -> (verdict, domainHash, imitated).
     verdict 1 Verified (green), 2 Frozen (grey, disable pay), 3 Lookalike (red: "Look-alike of <domain>. Likely address poisoning."
     and highlight the characters that differ from `imitated`), 0 Unknown (amber: "First payment: waits 10 minutes with Undo").
   - Approve the token for SafeSend once if allowance is too low, then call SafeSend.payByName(token, domainHash, amount, ref)
     for domains, or SafeSend.send(token, to, amount, ref) for addresses. Read the Escrowed event to get the escrow id.
2. Undo window: list my escrows (SafeSend.pendings(id)) with a live countdown to releaseAt, an Undo button
   (SafeSend.cancel(id), sender only, before releaseAt) and a Release button after (SafeSend.release(id)).
3. History shield: call our backend GET /api/history-scan?address=<me> and list poisoning attempts with the differing characters highlighted.
4. Business: domain input; show the TXT record to add: `_verifypay.<domain>  TXT  "arc:<connected address>"`;
   button PayeeRegistry.requestRegistration(domain); status from getPayee(keccak256(domain));
   "Change payout wallet": call backend POST /api/agent-pass/start {action:"payoutChange", params:{domainHash,newPayout}},
   show the World ID link/code, poll POST /api/agent-pass/poll {sessionId} every 5 s; on "approved" call
   PayeeRegistry.requestPayoutChange(domainHash, newPayout, deadline, signature); on denied/expired show "Nothing changed".
   Show the pending change countdown with Execute (after payoutEta) and Cancel (old wallet) buttons.
5. Agent wallet: show limits(token), spentToday(token), agent, owner, balance; "Raise limits" uses the same
   Agent Pass flow with action "raiseLimits" then AgentWallet.raiseLimits(token, perPayment, perDay, deadline, signature).

Backend: port the files in server/src (oidc.js, poisoning.js, approval.js, server.js) into this app's backend routes
unchanged in logic: /api/config, /api/agent-pass/start, /api/agent-pass/poll, /api/history-scan.
Secrets (APPROVAL_SIGNER_KEY, WORLD_CLIENT_ID, WORLD_CLIENT_SECRET) only as server environment variables.
Use Circle Wallets for sign-in if available in Studio; otherwise an injected wallet with Arc Testnet auto-added.
```
Then iterate in small prompts ("make the red look-alike banner bigger", "show explorer links after every transaction").

> Reference implementation: `web/` + `server/` in this repo are a complete working version of the same app. If Studio struggles with a piece, point it at the matching file: "Implement this exactly like web/app.js lines for the Undo window".

## Step 4 · Architecture diagram (required by Arc)
```
Add an Architecture page to the app that renders the Mermaid diagram from specs/02-TRD.md and lists the
contract addresses with explorer links.
```

## Step 5 · The agent ("Build an agent")
```
Build an agent with its own Arc Testnet wallet that pays verified businesses for API calls.
It must only call AgentWallet.agentPay(token, keccak256(domain), amount, ref) on <AgentWallet addr>, never pay a raw address.
Before paying, read PayeeRegistry.resolve(keccak256(domain)); if not Active, stop and report "refused: payee not verified".
On OverPerPayment/OverDaily, stop and report the limit instead of retrying. Log every payment with its explorer link.
```
Then call `setAgent(<agent address>)` on AgentWallet from the owner wallet. Reference: `agent/agent-pay.mjs`.

## Step 6 · Chainlink CRE (runs from your laptop, not Studio)
Studio has no CRE runtime, so run the workflow with the CRE CLI (it writes to the Studio-deployed registry):
```
cd cre && cre login && cre generate-bindings evm
cd verifypay-workflow && npm i && npm run typecheck
# put the PayeeRegistry address in config.staging.json; fund CRE_ETH_PRIVATE_KEY (.env) with Arc testnet USDC
cre workflow simulate verifypay-workflow --target staging-settings --broadcast
```
Trigger 0 (log, after requestRegistration) verifies; trigger 1 (cron) re-checks and freezes. Keep both tx links.

## Step 7 · World ID Agent Pass setup
Register the app at https://auth.world.org/portal, put the client id/secret in the backend env, and check
`https://auth.world.org/.well-known/openid-configuration` lists a `device_authorization_endpoint`
(the backend uses the device flow). If it doesn't, ask Studio: "switch the Agent Pass flow to the authorization-code
flow from https://auth.world.org/docs; keep validateIdToken unchanged". Fill `docs/world-debrief.md` as you go.

## Step 8 · Submission evidence from Studio
- Studio project URL in README and in the ETHGlobal form; say the bounty: **"Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio"**.
- Record 15–20 s of Studio in the video (the project, a prompt, the deploy panel).
- Mention the Circle tools used: Arc Studio, USDC + EURC on Arc, Circle faucet/Console, Circle Wallets (if used).

## Usage tips
- One prompt per feature; paste exact addresses and function names (Studio guesses less).
- Ask Studio to "run the tests again" after any contract-touching change (there should be none).
- If Studio proposes changing a contract, refuse unless a test proves a bug; the specs are the source of truth.
