// VerifyPay backend: World ID Agent Pass (device flow) -> server-side validation -> EIP-712 approval,
// address-poisoning history scan, and static hosting of /web. Node >= 22, one dependency (viem).
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, isAddress, isHex, parseAbi } from 'viem'
import { discover, fetchJwks, validateIdToken, startDeviceFlow, pollDeviceToken } from './oidc.js'
import { scanHistory, fromBlockscout, fromTransferLogs, mergeTransfers } from './poisoning.js'
import { fetchTransferLogs } from './transferLogs.js'
import { makeSigner } from './approval.js'

const env = process.env
const PORT = Number(env.PORT || 8787)
const CHAIN_ID = Number(env.CHAIN_ID || 5042002)
const ROOT = fileURLToPath(new URL('../../web/', import.meta.url))
const DATA = fileURLToPath(new URL('../data/', import.meta.url))
const TTL = Number(env.APPROVAL_TTL_SECONDS || 600)

const arc = { id: CHAIN_ID, name: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'] } } }
const client = createPublicClient({ chain: arc, transport: http() })
const registryAbi = parseAbi([
  'function nonces(bytes32) view returns (uint256)',
  'function resolve(bytes32) view returns (address payout, uint8 status)',
  'function getPayee(bytes32) view returns ((string domain,address controller,address payout,bytes32 leiHash,uint8 status,uint64 verifiedAt,address pendingPayout,uint64 payoutEta,address pendingController,uint64 controllerEta))',
])
const walletAbi = parseAbi(['function nonce() view returns (uint256)', 'function owner() view returns (address)'])
const signer = env.APPROVAL_SIGNER_KEY ? makeSigner(env.APPROVAL_SIGNER_KEY) : null

// ---- World ID Agent Pass ------------------------------------------------------------------
let oidcCache = null
async function oidc() {
  if (!oidcCache) {
    const d = await discover(env.WORLD_ISSUER || 'https://auth.world.org')
    oidcCache = { d, jwks: await fetchJwks(d.jwks_uri), at: Date.now() }
  } else if (Date.now() - oidcCache.at > 10 * 60_000) {
    oidcCache.jwks = await fetchJwks(oidcCache.d.jwks_uri) // key rotation
    oidcCache.at = Date.now()
  }
  return oidcCache
}
const sessions = new Map() // id -> {action, params, deviceCode, startedAt, expiresAt, status}

// Trust-on-first-use binding: the first World ID that approves for a domain/wallet becomes its owner;
// later approvals must come from the same human (World `sub`).
const bindingsFile = join(DATA, 'bindings.json')
async function loadBindings() { try { return JSON.parse(await readFile(bindingsFile, 'utf8')) } catch { return {} } }
async function saveBindings(b) { await mkdir(DATA, { recursive: true }); await writeFile(bindingsFile, JSON.stringify(b, null, 2)) }

function validateAction(action, p) {
  if (action === 'payoutChange') {
    if (!isHex(p.domainHash) || p.domainHash.length !== 66) throw new Error('domainHash')
    if (!isAddress(p.newPayout)) throw new Error('newPayout')
    return `payout:${p.domainHash.toLowerCase()}`
  }
  if (action === 'raiseLimits') {
    if (!isAddress(p.wallet) || !isAddress(p.token)) throw new Error('wallet/token')
    if (!/^\d+$/.test(String(p.perPayment)) || !/^\d+$/.test(String(p.perDay))) throw new Error('limits')
    return `wallet:${p.wallet.toLowerCase()}`
  }
  throw new Error('unknown action')
}

async function agentPassStart(body) {
  const bindingKey = validateAction(body.action, body.params || {})
  const { d } = await oidc()
  const dev = await startDeviceFlow(d, { clientId: env.WORLD_CLIENT_ID, clientSecret: env.WORLD_CLIENT_SECRET, scope: env.WORLD_SCOPE, authMethod: env.WORLD_CLIENT_AUTH })
  const id = randomUUID()
  const startedAt = Math.floor(Date.now() / 1000)
  sessions.set(id, { action: body.action, params: body.params, bindingKey, deviceCode: dev.device_code, startedAt, expiresAt: startedAt + (dev.expires_in || 300), status: 'pending' })
  return { sessionId: id, userCode: dev.user_code, verificationUri: dev.verification_uri, verificationUriComplete: dev.verification_uri_complete, expiresIn: dev.expires_in, interval: dev.interval || 5 }
}

async function agentPassPoll(body) {
  const s = sessions.get(body.sessionId)
  if (!s) return { status: 'unknown' }
  if (s.status !== 'pending') return { status: s.status, result: s.result, error: s.error }
  if (Math.floor(Date.now() / 1000) > s.expiresAt) { s.status = 'expired'; return { status: 'expired' } }
  const { d, jwks } = await oidc()
  const r = await pollDeviceToken(d, { clientId: env.WORLD_CLIENT_ID, clientSecret: env.WORLD_CLIENT_SECRET, deviceCode: s.deviceCode, authMethod: env.WORLD_CLIENT_AUTH })
  if (r.status === 'pending' || r.status === 'slow_down') return { status: 'pending' }
  if (r.status !== 'ok') { s.status = r.status; s.error = r.error; return { status: r.status, error: r.error } } // denied / expired / error: NO approval

  let claims
  try {
    claims = validateIdToken(r.idToken, { issuer: d.issuer, clientId: env.WORLD_CLIENT_ID, jwks, notBefore: s.startedAt })
  } catch (e) { s.status = 'rejected'; s.error = e.message; return { status: 'rejected', error: e.message } }

  const bindings = await loadBindings()
  const bound = bindings[s.bindingKey]
  if (bound && bound !== claims.sub) { s.status = 'rejected'; s.error = 'different human'; return { status: 'rejected', error: 'This World ID is not the owner of this payee/wallet' } }
  if (!bound) { bindings[s.bindingKey] = claims.sub; await saveBindings(bindings) }

  if (!signer) throw new Error('APPROVAL_SIGNER_KEY not set')
  const deadline = Math.floor(Date.now() / 1000) + TTL
  let result
  if (s.action === 'payoutChange') {
    const nonce = await client.readContract({ address: env.REGISTRY_ADDRESS, abi: registryAbi, functionName: 'nonces', args: [s.params.domainHash] })
    const signature = await signer.signPayoutChange({ chainId: CHAIN_ID, registry: env.REGISTRY_ADDRESS, domainHash: s.params.domainHash, newPayout: s.params.newPayout, nonce, deadline })
    result = { signature, deadline, nonce: nonce.toString() }
  } else {
    const nonce = await client.readContract({ address: s.params.wallet, abi: walletAbi, functionName: 'nonce' })
    const signature = await signer.signRaiseLimits({ chainId: CHAIN_ID, wallet: s.params.wallet, token: s.params.token, perPayment: s.params.perPayment, perDay: s.params.perDay, nonce, deadline })
    result = { signature, deadline, nonce: nonce.toString() }
  }
  s.status = 'approved'
  s.result = result
  return { status: 'approved', result }
}

// ---- Poisoning history scan ---------------------------------------------------------------
async function historyScan(address) {
  if (!isAddress(address)) throw new Error('address')
  const base = (env.ARC_EXPLORER_URL || 'https://explorer.testnet.arc.io').replace(/\/$/, '')
  const res = await fetch(`${base}/api/v2/addresses/${address}/token-transfers?type=ERC-20`)
  if (!res.ok) throw new Error(`explorer HTTP ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json.items)) throw new Error('explorer returned an unexpected response (no items list)')
  // Raw Transfer logs as well: the explorer list omits zero-value transfers (the poisoning itself).
  const tokens = [env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000', env.EURC_ADDRESS || '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a']
  const lookbackBlocks = BigInt(env.HISTORY_LOOKBACK_BLOCKS || 200000)
  const { logs, fromBlock, toBlock } = await fetchTransferLogs(client, { account: address, tokens, lookbackBlocks })
  const transfers = mergeTransfers(fromBlockscout(json.items), fromTransferLogs(logs))
  return { ...scanHistory(address, transfers), logWindow: { fromBlock: String(fromBlock), toBlock: String(toBlock) } }
}

// ---- HTTP ---------------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
async function readJson(req) {
  let raw = ''
  for await (const c of req) { raw += c; if (raw.length > 10_000) throw new Error('body too large') }
  return raw ? JSON.parse(raw) : {}
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/config') {
      return send(res, 200, { chainId: CHAIN_ID, rpcUrl: arc.rpcUrls.default.http[0], explorer: env.ARC_EXPLORER_URL || 'https://explorer.testnet.arc.io', registry: env.REGISTRY_ADDRESS, safeSend: env.SAFESEND_ADDRESS, agentWallet: env.AGENT_WALLET_ADDRESS, usdc: env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000', eurc: env.EURC_ADDRESS || '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', approvalSigner: signer?.address })
    }
    if (url.pathname === '/api/agent-pass/start' && req.method === 'POST') return send(res, 200, await agentPassStart(await readJson(req)))
    if (url.pathname === '/api/agent-pass/poll' && req.method === 'POST') return send(res, 200, await agentPassPoll(await readJson(req)))
    if (url.pathname === '/api/history-scan') return send(res, 200, await historyScan(url.searchParams.get('address')))
    // static
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '')
    const file = join(ROOT, rel)
    if (!file.startsWith(ROOT)) return send(res, 403, { error: 'forbidden' })
    const body = await readFile(file).catch(() => null)
    if (!body) return send(res, 404, { error: 'not found' })
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch (e) {
    send(res, 400, { error: e.message })
  }
}).listen(PORT, () => console.log(`VerifyPay on http://localhost:${PORT}`))
