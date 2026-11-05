# 00 · Idea (LOCKED)

## Name and one line
**VerifyPay**: the address-poisoning interceptor and self-freezing USDC settlement layer on Arc.
> "Copy-paste the wrong address and your USDC is gone forever. VerifyPay catches the look-alike before it lands, gives you an undo button, and freezes a business the moment its proof of identity disappears."

## Problem (real, global, existing)
- **Address poisoning:** scammers send dust or zero-value transfers from addresses that match your real counterparty's first and last characters, so you copy the wrong one from history.
  - 270M attacks, 17M targeted addresses, 5,500 victims, **$83.8M stolen** in stablecoins (Jul 2022 to Jun 2024, Ethereum + BSC). Source: Tsuchiya et al., "Blockchain Address Poisoning", arXiv 2501.16681.
  - **$50M USDT** lost in one copy-paste in December 2025 (The Block, Cointelegraph).
- **Payment redirection ("we changed our wallet") fraud:** the same attack by email. Banks answered with name checks (EU, mandatory since 9 Oct 2025); stablecoin payments have nothing enforced on-chain.

## Target users
1. **Payer** (a finance team or a person paying a business in USDC): wants to pay the right business, every time, with no crypto expertise.
2. **Business (payee)**: wants customers to find and pay its real wallet, and wants a hijacked email or domain to be unable to redirect money.
3. **Builders** (wallets, agents, dApps on Arc): want one call that says "safe to pay?".

## The 60-second wow
1. Payer's history shows a real payment to acme.com `0x8F4a…91B2`. Paste the poisoned `0x8F4a…(different)…91B2`. Red banner: **"Look-alike of acme.com"**. Send anyway: USDC goes into undo escrow. Tap **Undo**: money back, on-chain.
2. Delete acme.com's DNS TXT record live, run the CRE re-check: Acme flips to **Frozen**, `payByName` reverts.
3. Restore, re-verify, pay "acme.com": settles in one block.
4. Hijacked session tries to rotate Acme's payout wallet: World Agent Pass denied, nothing changes. Real owner approves: 2-minute public countdown; the old wallet can still cancel.

## Why blockchain
- The escrow, the delay and the freeze are rules nobody can bypass, including us: no admin withdraw, no admin unfreeze.
- `inspectRecipient()` is a public good any wallet, agent or dApp on Arc can call before paying.
- Verification is done by a Chainlink DON reaching consensus, not by one server key.

## What is new versus prior art (say this if asked)
| Prior art | What it does | What VerifyPay adds |
|---|---|---|
| Meigi (ETHGlobal Tokyo 2026) | Japanese payee registry, one attester key, 72h timelock | Global (any domain), decentralized CRE verification, **daily re-check + auto-freeze**, **automatic undo escrow**, **on-chain look-alike detection**, real USDC on Arc |
| UnSend (ETHGlobal Lisbon 2026) | Manual opt-in undo via wrapped token | Undo triggers **automatically** for risky recipients; no wrapping |
| Wallet warnings (Etherscan, Trust Wallet) | UI warnings only | Enforced in the contract, callable by anyone |

## Sponsors
- **Arc**: Best Smart Contracts with Advanced Stablecoin Logic (conditional flows, multi-step settlement, reusable contracts bonus).
- **Chainlink**: Best workflow with CRE (blockchain + external APIs, simulation counts).
- **World**: World ID Agent Pass (fresh human check gating the payout-wallet change).
