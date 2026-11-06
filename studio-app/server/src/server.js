// VerifyPay backend: World ID Agent Pass (device flow) -> server-side validation -> EIP-712 approval,
// and the address-poisoning history scan. Ported from verifypay-maria/server/src/server.js with the same
// logic. Differences: contract addresses come from .env (VITE_*), chain facts come from src/onchain-facts.ts,
// the Vite dev server hosts the frontend, and bindings are persisted by ./bindings.js.
// Run with bun (it loads .env at startup): `bun run server`.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, getAddress, isAddress, isHex, parseAbi } from 'viem'
import { discover, fetchJwks, validateIdToken, startDeviceFlow, pollDeviceToken } from './oidc.js'
import { scanHistory, fromBlockscout } from './poisoning.js'
import { makeSigner } from './approval.js'
import { createBindings } from './bindings.js'
import { getUsdc, requireChain } from '../../src/onchain-facts.ts'

const env = process.env
const PORT = Number(env.PORT || 8787)
const CHAIN_ID = 5042002
const COMPASS_CHAIN = 'Arc_Testnet'
const TTL = Number(env.APPROVAL_TTL_SECONDS || 600)
const DATA = fileURLToPath(new URL('../data/', import.meta.url))

// ---- Configuration: every value is read from .env or the chain facts, never typed here ----------
function requireEnv(name) {
  const v = env[name]
  if (!v) throw new Error(`${name} is not set in .env`)
  return v
}
function requireAddressEnv(name) {
  const v = requireEnv(name)
  if (!isAddress(v)) throw new Error(`${name} is not a valid address`)
  return getAddress(v)
}
const chain = requireChain(CHAIN_ID)
const usdc = getUsdc(CHAIN_ID)
if (!usdc) throw new Error('USDC is missing from the chain facts for Arc Testnet')
const REGISTRY = requireAddressEnv('VITE_REGISTRY_ADDRESS')
const SAFESEND = requireAddressEnv('VITE_SAFESEND_ADDRESS')
const AGENT_WALLET = requireAddressEnv('VITE_AGENT_WALLET_ADDRESS')
const EURC = requireAddressEnv('VITE_EURC_ADDRESS')
const USDC = getAddress(usdc.address)
const PUBLIC_RPC = chain.rpcUrls[0]
const EXPLORER = chain.explorerBase

// Server-side reads use the sandbox RPC proxy when it covers this chain, else the public RPC.
// The proxy URL carries a token: it is never logged or returned (see safeMessage).
const proxyChains = (env.RPC_PROXY_CHAINS || '').split(',')
const serverRpc =
  env[`RPC_URL_${COMPASS_CHAIN}`] ||
  (env.RPC_PROXY_BASE_URL && proxyChains.includes(COMPASS_CHAIN)
    ? `${env.RPC_PROXY_BASE_URL}/api/rpc/${COMPASS_CHAIN}?_rpc_token=${env.RPC_PROXY_TOKEN}`
    : PUBLIC_RPC)

const arc = {
  id: CHAIN_ID,
  name: chain.name,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: chain.nativeCurrency.decimals },
  rpcUrls: { default: { http: [serverRpc] } },
}
const client = createPublicClient({ chain: arc, transport: http() })
const registryAbi = parseAbi([
  'function nonces(bytes32) view returns (uint256)',
  'function approvalSigner() view returns (address)',
])
const walletAbi = parseAbi(['function nonce() view returns (uint256)', 'function approvalSigner() view returns (address)'])

/** Error text that is safe to send to the browser: no secret or RPC token can appear in it. */
function safeMessage(e) {
  let msg = String(e?.shortMessage || e?.message || e)
  for (const s of [env.APPROVAL_SIGNER_KEY, env.WORLD_CLIENT_SECRET, env.RPC_PROXY_TOKEN, serverRpc]) {
    if (s) msg = msg.split(s).join('[redacted]')
  }
  return msg
}

// ---- Approval signer: startup guard -------------------------------------------------------------
let signer = null
let signerGate = { ok: false, reason: 'APPROVAL_SIGNER_KEY is not set' }
if (env.APPROVAL_SIGNER_KEY) {
  try {
    signer = makeSigner(env.APPROVAL_SIGNER_KEY)
  } catch {
    signerGate = { ok: false, reason: 'APPROVAL_SIGNER_KEY is not a valid private key' }
    console.error(signerGate.reason)
  }
}
if (signer) {
  console.log(`Approval signer address (derived from APPROVAL_SIGNER_KEY): ${signer.address}`)
  const expected = env.VITE_APPROVAL_SIGNER_ADDRESS
  if (!expected || !isAddress(expected)) {
    signerGate = { ok: false, reason: 'VITE_APPROVAL_SIGNER_ADDRESS is not set to a valid address; refusing to sign' }
  } else if (getAddress(expected) !== signer.address) {
    signerGate = {
      ok: false,
      reason: `derived signer ${signer.address} does not match the expected approval signer ${getAddress(expected)}; refusing to sign`,
    }
  } else {
    signerGate = { ok: true }
  }
  if (signerGate.ok) console.log('Approval signer matches the expected approval signer.')
  else console.error(signerGate.reason)
}

// The deployed contracts must trust this exact signer too. Checked on chain before the first signature
// (retried on every request until the read succeeds, so a flaky RPC at startup cannot disable it).
let signerTrustedOnChain = false
async function requireSigner() {
  if (!signer) throw new Error(signerGate.reason)
  if (!signerGate.ok) throw new Error(signerGate.reason)
  if (!signerTrustedOnChain) {
    const [reg, wal] = await Promise.all([
      client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'approvalSigner' }),
      client.readContract({ address: AGENT_WALLET, abi: walletAbi, functionName: 'approvalSigner' }),
    ])
    if (getAddress(reg) !== signer.address || getAddress(wal) !== signer.address) {
      throw new Error(`the deployed contracts do not trust ${signer.address} as approval signer; refusing to sign`)
    }
    signerTrustedOnChain = true
  }
}

// ---- World ID Agent Pass ------------------------------------------------------------------
function worldCreds() {
  if (!env.WORLD_CLIENT_ID) throw new Error('WORLD_CLIENT_ID is not set on the server')
  return { clientId: env.WORLD_CLIENT_ID, clientSecret: env.WORLD_CLIENT_SECRET, authMethod: env.WORLD_CLIENT_AUTH }
}
const WORLD_ISSUER = env.WORLD_ISSUER || 'https://auth.world.org'

let oidcCache = null
async function oidc() {
  if (!oidcCache) {
    const d = await discover(WORLD_ISSUER)
    oidcCache = { d, jwks: await fetchJwks(d.jwks_uri), at: Date.now() }
  } else if (Date.now() - oidcCache.at > 10 * 60_000) {
    oidcCache.jwks = await fetchJwks(oidcCache.d.jwks_uri) // key rotation
    oidcCache.at = Date.now()
  }
  return oidcCache
}
const sessions = new Map() // id -> {action, params, deviceCode, startedAt, expiresAt, status}
const bindings = createBindings(`${DATA}bindings.json`)

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
  await requireSigner() // do not start a World ID check we could not turn into an approval
  const creds = worldCreds()
  const { d } = await oidc()
  const dev = await startDeviceFlow(d, { ...creds, scope: env.WORLD_SCOPE })
  const id = randomUUID()
  const startedAt = Math.floor(Date.now() / 1000)
  for (const [k, v] of sessions) if (v.expiresAt + 3600 < startedAt) sessions.delete(k)
  sessions.set(id, { action: body.action, params: body.params, bindingKey, deviceCode: dev.device_code, startedAt, expiresAt: startedAt + (dev.expires_in || 300), status: 'pending' })
  return { sessionId: id, userCode: dev.user_code, verificationUri: dev.verification_uri, verificationUriComplete: dev.verification_uri_complete, expiresIn: dev.expires_in, interval: dev.interval || 5 }
}

async function agentPassPoll(body) {
  const s = sessions.get(body.sessionId)
  if (!s) return { status: 'unknown' }
  if (s.status !== 'pending') return { status: s.status, result: s.result, error: s.error }
  if (Math.floor(Date.now() / 1000) > s.expiresAt) { s.status = 'expired'; return { status: 'expired' } }
  const creds = worldCreds()
  const { d, jwks } = await oidc()
  const r = await pollDeviceToken(d, { ...creds, deviceCode: s.deviceCode })
  if (r.status === 'pending' || r.status === 'slow_down') return { status: 'pending' }
  if (r.status !== 'ok') { s.status = r.status; s.error = r.error; return { status: r.status, error: r.error } } // denied / expired / error: NO approval

  let claims
  try {
    claims = validateIdToken(r.idToken, { issuer: d.issuer, clientId: creds.clientId, jwks, notBefore: s.startedAt })
  } catch (e) { s.status = 'rejected'; s.error = e.message; return { status: 'rejected', error: e.message } }

  await requireSigner() // before binding: a failed signer must not claim a payee for this human

  // Trust-on-first-use: the first World ID that approves for a domain/wallet becomes its owner.
  const binding = await bindings.bindOrCheck(s.bindingKey, claims.sub)
  if (binding === 'different') { s.status = 'rejected'; s.error = 'different human'; return { status: 'rejected', error: 'This World ID is not the owner of this payee/wallet' } }

  const deadline = Math.floor(Date.now() / 1000) + TTL
  let result
  if (s.action === 'payoutChange') {
    const nonce = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'nonces', args: [s.params.domainHash] })
    const signature = await signer.signPayoutChange({ chainId: CHAIN_ID, registry: REGISTRY, domainHash: s.params.domainHash, newPayout: s.params.newPayout, nonce, deadline })
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
  const res = await fetch(`${EXPLORER}/api/v2/addresses/${address}/token-transfers?type=ERC-20`)
  if (!res.ok) throw new Error(`explorer HTTP ${res.status}`)
  const json = await res.json()
  // An explorer reply without `items` is an error, not "no transfers": never report a clean history from it.
  if (!Array.isArray(json.items)) throw new Error('explorer returned an unexpected response (no items list)')
  return scanHistory(address, fromBlockscout(json.items))
}

// ---- HTTP ---------------------------------------------------------------------------------
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
async function readJson(req) {
  let raw = ''
  for await (const c of req) { raw += c; if (raw.length > 10_000) throw new Error('body too large') }
  return raw ? JSON.parse(raw) : {}
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return send(res, 200, { chainId: CHAIN_ID, rpcUrl: PUBLIC_RPC, explorer: EXPLORER, registry: REGISTRY, safeSend: SAFESEND, agentWallet: AGENT_WALLET, usdc: USDC, eurc: EURC, approvalSigner: signer?.address ?? null })
    }
    if (url.pathname === '/api/agent-pass/start' && req.method === 'POST') return send(res, 200, await agentPassStart(await readJson(req)))
    if (url.pathname === '/api/agent-pass/poll' && req.method === 'POST') return send(res, 200, await agentPassPoll(await readJson(req)))
    if (url.pathname === '/api/history-scan' && req.method === 'GET') return send(res, 200, await historyScan(url.searchParams.get('address')))
    return send(res, 404, { error: 'not found' })
  } catch (e) {
    send(res, 400, { error: safeMessage(e) })
  }
}).listen(PORT, () => console.log(`VerifyPay backend on http://localhost:${PORT}`))
