# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```

## VerifyPay deployments (Arc Testnet, chain 5042002)

Source of truth for the repo is `verifypay-maria/`. Contract copies live in `contracts/` (byte-identical) and tests in `contracts/test/`.
Addresses are read from `.env` (`VITE_REGISTRY_ADDRESS`, `VITE_SAFESEND_ADDRESS`, `VITE_AGENT_WALLET_ADDRESS`). Do not hard-code them elsewhere.

| Contract | Address | Deploy tx |
|---|---|---|
| PayeeRegistry | 0xc2035DA8766Fa4F68D405857A155dB52F15790cc | 0x79b6d292ce666895904afdce69c42837e3348ee6bc2c48d6b8e604094938722d |
| SafeSend | 0x88E2AFe1308CA7127D1c11926Dd4879c8b8e1924 | 0x66663a183e699f7f822a82963bbb354ec0cf3965729400690289e8a61b6b1fa2 |
| AgentWallet | 0xe905031D8C16d668282d917182D829CAc6C45358 | 0xf4bab76f652fd64551b37306021b6c3c916c4f42b187bd56e02789476c57b240 |

Deployer (Circle smart account): 0xa3039A54856ed74B5AEc999EeF3fc954Ab010Cf6. All three are source-verified on https://explorer.testnet.arc.io.

## VerifyPay backend (`server/`)

- Ported from `verifypay-maria/server/` (`oidc.js`, `approval.js`, `poisoning.js` and their tests are byte-identical copies; `server.js` is adapted). `bindings.js` is new: persistent same-human store at `server/data/bindings.json` (atomic writes, corrupt file = error, never reset).
- Run: `bun run server` (port 8787, loads `.env`). Tests: `bun run test:server`. Vite proxies `/api` to it (no rewrite).
- Routes: `GET /api/config`, `POST /api/agent-pass/start`, `POST /api/agent-pass/poll`, `GET /api/history-scan?address=`.
- Secrets (`APPROVAL_SIGNER_KEY`, `WORLD_CLIENT_ID`, `WORLD_CLIENT_SECRET`) live in `.env` WITHOUT a `VITE_` prefix. Never read, print or log them.
- Signing is refused unless the key's address equals `VITE_APPROVAL_SIGNER_ADDRESS` AND the deployed PayeeRegistry and AgentWallet report that same `approvalSigner()`.
- `verifypay-maria/` is excluded from the root lint; do not edit its files.

## Wallet layer (frontend)

- `src/wallet/WalletProvider.tsx` (viem + injected wallet, no wagmi hooks) exposes `useWallet()` from `src/wallet/walletContext.ts`: `account`, `chainId`, `onArc`, `connect`, `switchToArc`, and `write(params, label)` which simulates, sends, waits for the receipt and records `tx` for `<TxStatus />`. Every later screen must send transactions through `write()`.
- All addresses come from `GET /api/config` (`src/lib/appConfig.ts`). Never hard-code them in `src/`.
- Custom errors are decoded from the contract ABIs in `src/abis/*.json` (`src/lib/txErrors.ts`). After any contract change: `forge build` then `bun run abis:sync`.
- Balances: `useBalances()` (ERC20 `balanceOf`, 6 decimals, refreshed every 8s and after each transaction).

## Pay screen (`src/components/pay/`)

- `PayScreen.tsx` (UI), `usePay.ts` (allowance -> approve exact amount -> `payByName` / `send`, decodes `Escrowed`), `VerdictChip.tsx` (live verdict + look-alike diff). Lookup logic is `src/lib/recipient.ts` (`resolve`, `inspectRecipient`, `getPayee`); input is only trimmed, never lowercased (same as web/app.js).
- Held payments: escrow ids are saved to localStorage key `vp:pending:<safeSend>` for the Undo window screen (also readable from `Escrowed` logs).

## GitHub sync (after every step)

0. Before syncing run `diff -r verifypay-maria/server/src server/src` and tell the user if the two differ (`studio-app/server` is a copy of the repo's `server/`, so they must never drift silently). `oidc.js`, `approval.js`, `poisoning.js` are expected to be identical; `server.js` and `bindings.js` are intentionally different.
1. `bash scripts/sync-studio-app.sh` copies this app into `verifypay-maria/studio-app/` (never `.env*`, `node_modules`, `dist`, `server/data`, `.circle`, `recovery_file*`, logs; never the Solidity contracts).
2. `git -C verifypay-maria add studio-app AI_USAGE.md`, then scan the staged files (file names and match counts only) for assignments to PRIVATE_KEY or CLIENT_SECRET names and for 64-hex values after an equals sign.
3. One commit per step, message ending with a blank line and `Built in Arc Studio`; append a row to `verifypay-maria/AI_USAGE.md` in the same commit.
4. `git -C verifypay-maria push origin main`. Never touch `verifypay-maria/src`, `test`, `cre`, `web`, `server`.

## Undo window (`src/components/undo/`)

- `UndoWindow.tsx` + `EscrowCard.tsx`; data in `src/lib/escrows.ts` (`loadEscrows`): `Escrowed` logs where sender = me from block 70933971 (SafeSend deployment block; the Arc RPC rejects ranges of about 20,000 blocks, so logs are read in 10,000-block chunks and incrementally after the first scan), merged with `vp:pending:<safeSend>` ids, then `SafeSend.pendings(id)`. Closed escrows show undone / released from the `Cancelled` / `Released` events.
- `src/hooks/useChainTime.ts`: countdowns use the latest block timestamp (re-read every 3s), never the local date. Button state (Undo vs Release) follows the last block actually read.
- `write()` invalidates `['escrows']` and `['balances']` after every successful transaction.

## History shield (`src/components/history/`)

- `HistoryShield.tsx` calls `GET /api/history-scan?address=` (`src/lib/historyScan.ts`). The backend reads only the FIRST page of Blockscout token transfers (`type=ERC-20`, up to 50 items); the route returns `scanned` (items read) and `hasMore` (explorer `next_page_params`) next to the unchanged detection result, and the UI states how much was scanned.
- `src/components/AddressDiff.tsx` is the shared character-diff view (Pay look-alike banner and History shield).
