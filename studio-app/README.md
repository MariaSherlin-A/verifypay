# VerifyPay on Arc

VerifyPay catches look-alike (address-poisoned) recipients before a USDC payment lands, holds risky payments in a 10-minute undo escrow, and freezes a business payee when its domain proof disappears. The three contracts are deployed on Arc Testnet.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack
Vite, React, TypeScript, wagmi/viem, Foundry (Solidity 0.8.28). The Solidity contracts, tests, Chainlink CRE workflow and specs live in the main VerifyPay repository; this app is the Arc Studio build on top of the deployed contracts.

## Contracts (Arc Testnet, chain 5042002)
- PayeeRegistry: `0xc2035DA8766Fa4F68D405857A155dB52F15790cc`
- SafeSend: `0x88E2AFe1308CA7127D1c11926Dd4879c8b8e1924`
- AgentWallet: `0xe905031D8C16d668282d917182D829CAc6C45358`

## Development
Prerequisites: bun, Foundry.

```
bun install
bun run dev          # web app (proxies /api to the backend)
bun run server       # backend on port 8787
bun run test:server  # backend tests (needs Node 22+)
bun run abis:sync    # refresh src/abis/*.json from contracts/out after forge build
forge test           # 45 contract tests
```

The web app connects an injected browser wallet (MetaMask, Rabby), switches it to Arc Testnet, and shows live USDC and EURC balances. Contract addresses are loaded from the backend, never hard-coded in the frontend.

The Pay screen takes a business domain or a wallet address and shows a live verdict from the chain: verified (instant), frozen (blocked), a look-alike of a registered business (held 10 minutes with undo), or a first-time address (held 10 minutes with undo).

The Undo window below it lists your held payments straight from the chain, with a countdown based on chain time. Before the window closes you can undo a payment and get your money back; after it closes anyone can release it to the recipient.

The backend provides the World ID approval step, the address-poisoning history scan, and the app configuration at `/api/config`.

### Environment variables
Public (safe for the browser):
- `VITE_REGISTRY_ADDRESS`, `VITE_SAFESEND_ADDRESS`, `VITE_AGENT_WALLET_ADDRESS`: deployed contract addresses.
- `VITE_EURC_ADDRESS`: EURC token address.
- `VITE_APPROVAL_SIGNER_ADDRESS`: the approval signer address the backend must match.

Server-only (never prefix with `VITE_`):
- `APPROVAL_SIGNER_KEY`: private key of the approval signer.
- `WORLD_CLIENT_ID`, `WORLD_CLIENT_SECRET`: World ID app credentials.
- `WORLD_ISSUER`, `WORLD_SCOPE`, `WORLD_CLIENT_AUTH`: World ID settings (`basic` or `post`).
- `APPROVAL_TTL_SECONDS`: how long an approval stays valid.
- `PORT`: backend port (default 8787).
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`, `RPC_URL_Arc_Testnet`: optional RPC settings. Arc Studio provides the proxy ones; outside Arc Studio the backend uses the public Arc Testnet RPC.
