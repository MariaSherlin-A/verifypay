// Software-to-software payment: an AI agent pays a CRE-verified business by DOMAIN from its AgentWallet.
// Usage: AGENT_KEY=0x... AGENT_WALLET_ADDRESS=0x... node agent/agent-pay.mjs acme.com 1.25 [usdc|eurc]
// Needs: npm i viem@2.34.0 (or run from /server after npm i)
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toBytes, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const [domain, amountStr, tok = 'usdc'] = process.argv.slice(2)
if (!domain || !amountStr) { console.error('usage: node agent/agent-pay.mjs <domain> <amount> [usdc|eurc]'); process.exit(1) }
const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'
const arc = { id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }
const token = tok === 'eurc' ? '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' : '0x3600000000000000000000000000000000000000'
// Custom errors from src/AgentWallet.sol, so a refusal prints its name (e.g. OverPerPayment) instead of a raw selector.
const abi = parseAbi([
  'function agentPay(address token, bytes32 domainHash, uint256 amount, bytes32 ref)',
  'error NotAgent()',
  'error IsPaused()',
  'error ZeroAmount()',
  'error PayeeNotActive(uint8 status)',
  'error OverPerPayment(uint256 amount, uint256 cap)',
  'error OverDaily(uint256 wouldSpend, uint256 cap)',
  'error TransferFailed()',
])

const account = privateKeyToAccount(process.env.AGENT_KEY)
const pub = createPublicClient({ chain: arc, transport: http(RPC) })
const wallet = createWalletClient({ account, chain: arc, transport: http(RPC) })
const domainHash = keccak256(toBytes(domain))
const ref = keccak256(toBytes(`agent:${domain}:${Date.now()}`))

try {
  // simulate first: reverts with PayeeNotActive / OverPerPayment / OverDaily are shown without spending gas
  const { request } = await pub.simulateContract({ account, address: process.env.AGENT_WALLET_ADDRESS, abi, functionName: 'agentPay', args: [token, domainHash, parseUnits(amountStr, 6), ref] })
  const hash = await wallet.writeContract(request)
  const r = await pub.waitForTransactionReceipt({ hash })
  console.log(`paid ${amountStr} ${tok.toUpperCase()} to ${domain}: ${r.status} ${hash}`)
} catch (e) {
  const reverted = e.walk?.((x) => x?.data?.errorName) // decoded custom error, if the contract reverted with one
  const reason = reverted
    ? `${reverted.data.errorName}(${(reverted.data.args ?? []).map(String).join(', ')})`
    : e.shortMessage || e.message
  console.error(`agent payment refused: ${reason}`) // degrade gracefully, never retry to a raw address
  process.exit(2)
}
