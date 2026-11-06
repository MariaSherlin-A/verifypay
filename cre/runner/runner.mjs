// VerifyPay CRE runner: starts the real Chainlink CRE workflow automatically.
//
// It does not reimplement or fake anything. For every RegistrationRequested event on PayeeRegistry it runs
//   cre workflow simulate verifypay-workflow --target staging-settings --broadcast --trigger-index 0 --evm-tx-hash <tx> ...
// and every RECHECK_MINUTES it runs trigger 1 (the daily re-check that freezes payees whose DNS proof is gone).
// Both are the same commands we ran by hand; the CRE CLI does the DNS reads, consensus and the on-chain write.
//
// Why a runner: deploying to the Chainlink DON needs deployment access we do not have yet. Once it is granted,
// `cre workflow deploy` replaces this file and the DON runs the same triggers itself.
//
// Run from the repo:  cd cre/runner && npm i && node runner.mjs
// Needs: the CRE CLI logged in (`cre login`) or CRE_API_KEY, Bun, and cre/.env with CRE_ETH_PRIVATE_KEY (gas).
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, parseAbiItem } from 'viem'

const CRE_DIR = fileURLToPath(new URL('../', import.meta.url))
const STATE_FILE = fileURLToPath(new URL('./.state.json', import.meta.url))
const config = JSON.parse(readFileSync(new URL('../verifypay-workflow/config.staging.json', import.meta.url), 'utf8'))

const REGISTRY = process.env.REGISTRY_ADDRESS || config.registryAddress
const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'
const POLL_MS = Number(process.env.POLL_SECONDS || 20) * 1000
const RECHECK_MS = Number(process.env.RECHECK_MINUTES || 30) * 60_000
const CRE_BIN = process.env.CRE_BIN || 'cre'
const DRY_RUN = process.argv.includes('--dry-run') // simulate without --broadcast (no transaction)
const CHUNK = 10_000n // the Arc RPC rejects larger log ranges

const EVENT = parseAbiItem('event RegistrationRequested(bytes32 indexed domainHash, string domain, address indexed requester)')
const client = createPublicClient({ transport: http(RPC, { retryCount: 5, retryDelay: 1500 }) })

const log = (...a) => console.log(new Date().toISOString(), ...a)
const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { lastBlock: null, done: [] })
const saveState = (s) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))

/** Runs one CRE CLI simulation and returns the workflow's own log lines (resolver results, action, tx hash). */
function runCre(args) {
  const full = ['workflow', 'simulate', 'verifypay-workflow', '--target', 'staging-settings', '--non-interactive', ...args]
  if (!DRY_RUN) full.push('--broadcast')
  return new Promise((resolve) => {
    const p = spawn(CRE_BIN, full, { cwd: CRE_DIR, shell: process.platform === 'win32', env: process.env })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => {
      const lines = out.split(/\r?\n/).filter((l) => /\[USER LOG\]|Workflow Simulation Result|✗|error/i.test(l))
      resolve({ code, lines })
    })
  })
}

// One CRE run at a time: two simulations writing in parallel would race on the CRE wallet nonce.
let busy = Promise.resolve()
const serial = (fn) => (busy = busy.then(fn, fn))

const RESOLVE = parseAbiItem('function resolve(bytes32 domainHash) view returns (address payout, uint8 status)')
const STATUS = ['None', 'Pending', 'Active', 'Frozen']
const isRateLimited = (r) => r.lines.some((l) => /429|rate limit/i.test(l))

async function handleRegistration(l) {
  // Anyone can call requestRegistration, so repeated requests must not burn the CRE wallet's gas:
  // only a Pending domain gets an immediate run. Active and Frozen domains are covered by the scheduled re-check.
  const [, status] = await client.readContract({ address: REGISTRY, abi: [RESOLVE], functionName: 'resolve', args: [l.args.domainHash] })
  if (status !== 1) {
    log(`registration "${l.args.domain}" in ${l.transactionHash}: already ${STATUS[status]}, left to the scheduled re-check`)
    return true
  }
  // --evm-event-index is the position of the log inside its transaction receipt.
  const receipt = await client.getTransactionReceipt({ hash: l.transactionHash })
  const index = receipt.logs.findIndex((x) => x.logIndex === l.logIndex)
  log(`registration "${l.args.domain}" in ${l.transactionHash} (event index ${index}) → CRE trigger 0`)
  const r = await runCreWithRetry(['--trigger-index', '0', '--evm-tx-hash', l.transactionHash, '--evm-event-index', String(index)])
  return r.code === 0
}

/** The public Arc RPC throttles bursts (429). One retry after a pause, never a loop. */
async function runCreWithRetry(args) {
  let r = await runCre(args)
  if (r.code !== 0 && isRateLimited(r)) {
    log('    rate-limited by the Arc RPC, retrying once in 20 s')
    await new Promise((res) => setTimeout(res, 20_000))
    r = await runCre(args)
  }
  r.lines.forEach((x) => log('   ', x.trim()))
  log(`    exit ${r.code}`)
  return r
}

async function pollRegistrations(state) {
  const head = await client.getBlockNumber()
  if (state.lastBlock === null) state.lastBlock = String(head - 20_000n) // first start: look back ~3 hours
  for (let from = BigInt(state.lastBlock) + 1n; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head
    const logs = await client.getLogs({ address: REGISTRY, event: EVENT, fromBlock: from, toBlock: to })
    for (const l of logs) {
      const key = `${l.transactionHash}:${l.logIndex}`
      if (state.done.includes(key)) continue
      const ok = await serial(() => handleRegistration(l))
      // A failed run is not retried in a loop: it is logged and left for the next re-check, which covers every payee.
      state.done.push(key)
      if (!ok) log(`    run failed for ${key}; the scheduled re-check will look at this domain again`)
    }
    state.lastBlock = String(to)
    saveState(state)
  }
}

async function recheck() {
  log('scheduled re-check of every payee → CRE trigger 1')
  await serial(() => runCreWithRetry(['--trigger-index', '1']))
}

async function main() {
  log(`VerifyPay CRE runner · registry ${REGISTRY} · ${DRY_RUN ? 'DRY RUN (no transactions)' : 'broadcasting'} · poll ${POLL_MS / 1000}s · re-check every ${RECHECK_MS / 60_000} min`)
  const state = loadState()
  if (process.argv.includes('--recheck-now')) await recheck()
  setInterval(() => recheck().catch((e) => log('re-check error:', e.shortMessage || e.message)), RECHECK_MS)
  for (;;) {
    try {
      await pollRegistrations(state)
    } catch (e) {
      log('poll error (will retry):', e.shortMessage || e.message)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main()
