// VerifyPay web app: plain ES modules, viem from a CDN (no build step).
import {
  createPublicClient, createWalletClient, custom, http, parseAbi, keccak256, toBytes,
  parseUnits, formatUnits, decodeEventLog, isAddress, getAddress, maxUint256,
} from 'https://esm.sh/viem@2.34.0'

const $ = (id) => document.getElementById(id)
const cfg = await (await fetch('/api/config')).json()

const arc = {
  id: cfg.chainId, name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, // gas token; we never use native value
  rpcUrls: { default: { http: [cfg.rpcUrl] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: cfg.explorer } },
}
const pub = createPublicClient({ chain: arc, transport: http(cfg.rpcUrl) })
let wallet = null
let account = null

const registryAbi = parseAbi([
  'function requestRegistration(string domain) returns (bytes32)',
  'function resolve(bytes32) view returns (address payout, uint8 status)',
  'function inspectRecipient(address) view returns (uint8 verdict, bytes32 domainHash, address imitated)',
  'function getPayee(bytes32) view returns ((string domain,address controller,address payout,bytes32 leiHash,uint8 status,uint64 verifiedAt,address pendingPayout,uint64 payoutEta,address pendingController,uint64 controllerEta))',
  'function requestPayoutChange(bytes32 d, address newPayout, uint256 deadline, bytes sig)',
  'function executePayoutChange(bytes32 d)',
  'function cancelPayoutChange(bytes32 d)',
])
const safeAbi = parseAbi([
  'function payByName(address token, bytes32 domainHash, uint256 amount, bytes32 ref)',
  'function send(address token, address to, uint256 amount, bytes32 ref) returns (bool escrowed, uint256 id)',
  'function cancel(uint256 id)',
  'function release(uint256 id)',
  'function pendings(uint256) view returns (address token, address sender, address to, uint128 amount, uint64 releaseAt, uint8 reason, bool open)',
  'event Escrowed(uint256 indexed id, address token, address indexed sender, address indexed to, uint256 amount, uint8 reason, address imitated, uint64 releaseAt, bytes32 ref)',
])
const erc20Abi = parseAbi([
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])
const walletAbi = parseAbi([
  'function limits(address) view returns (uint128 perPayment, uint128 perDay)',
  'function spentToday(address) view returns (uint256)',
  'function agent() view returns (address)',
  'function owner() view returns (address)',
  'function raiseLimits(address token, uint128 perPayment, uint128 perDay, uint256 deadline, bytes sig)',
])

const STATUS = ['None', 'Pending', 'Active', 'Frozen']
const VERDICT = { Unknown: 0, Verified: 1, Frozen: 2, Lookalike: 3 }
const tokenAddr = () => ($('token').value === 'eurc' ? cfg.eurc : cfg.usdc)
const tokenSym = () => ($('token').value === 'eurc' ? 'EURC' : 'USDC')
const isDomain = (s) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`
const txLink = (h) => `<a href="${cfg.explorer}/tx/${h}" target="_blank" rel="noopener">${short(h)}</a>`
const msg = (id, text, err = false) => { $(id).innerHTML = text; $(id).className = `msg${err ? ' err' : ''}` }
const errText = (e) => e?.shortMessage || e?.message || String(e)

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b))
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === b.dataset.tab))
  if (b.dataset.tab === 'pending') renderPending()
  if (b.dataset.tab === 'agent') renderAgent()
}))

// ---------- wallet ----------
$('connect').addEventListener('click', async () => {
  if (!window.ethereum) return alert('Install a browser wallet (e.g. MetaMask) to continue')
  wallet = createWalletClient({ chain: arc, transport: custom(window.ethereum) })
  ;[account] = await wallet.requestAddresses()
  try { await wallet.switchChain({ id: arc.id }) } catch { await wallet.addChain({ chain: arc }) }
  $('connect').textContent = short(account)
  updateTxt()
})

async function write(params) {
  if (!wallet) throw new Error('Connect your wallet first')
  const hash = await wallet.writeContract({ account, chain: arc, ...params })
  const receipt = await pub.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`)
  return { hash, receipt }
}

// ---------- Pay ----------
let current = null // { kind: 'domain'|'address', target, verdict, domainHash, imitated }
let debounce
$('recipient').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(checkRecipient, 300) })
$('amount').addEventListener('input', () => updatePayBtn())

function chip(cls, text) { const c = $('verdict'); c.className = `chip show ${cls}`; c.textContent = text }

function highlightDiff(addr, imitated) {
  // Show the middle characters that differ from the real payee: people only check the ends.
  const a = getAddress(addr), b = getAddress(imitated)
  let out = ''
  for (let i = 0; i < a.length; i++) out += a[i].toLowerCase() !== b[i].toLowerCase() ? `<mark>${a[i]}</mark>` : a[i]
  return `You pasted: ${out}<br/>Real payee: ${b}`
}

async function checkRecipient() {
  const v = $('recipient').value.trim()
  $('addrDiff').innerHTML = ''
  current = null
  if (!v) { $('verdict').className = 'chip'; return updatePayBtn() }
  try {
    if (isDomain(v)) {
      const domainHash = keccak256(toBytes(v))
      const [payout, status] = await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: 'resolve', args: [domainHash] })
      current = { kind: 'domain', target: v, domainHash, status, payout }
      if (status === 2) chip('ok', `✔ Verified · ${v} → ${short(payout)} · settles instantly`)
      else if (status === 3) chip('frozen', `⛔ ${v} is frozen: its verification lapsed. Payments are blocked.`)
      else chip('warn', `${v} is not a verified business on VerifyPay`)
    } else if (isAddress(v)) {
      const [verdict, domainHash, imitated] = await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: 'inspectRecipient', args: [v] })
      current = { kind: 'address', target: v, verdict, domainHash, imitated }
      if (verdict === VERDICT.Verified) chip('ok', '✔ Verified business wallet · settles instantly')
      else if (verdict === VERDICT.Frozen) chip('frozen', '⛔ This business is frozen. Payments are blocked.')
      else if (verdict === VERDICT.Lookalike) {
        const p = await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: 'getPayee', args: [domainHash] })
        chip('bad', `⚠ Look-alike of ${p.domain}. Likely address poisoning. Payment will wait 10 minutes with Undo.`)
        $('addrDiff').innerHTML = highlightDiff(v, imitated)
      } else chip('warn', 'First payment to this address: it will wait 10 minutes with Undo')
    } else chip('warn', 'Enter a domain like acme.com or a 0x address')
  } catch (e) { chip('bad', `Lookup failed: ${errText(e)}`) }
  updatePayBtn()
}

function updatePayBtn() {
  const ok = current && Number($('amount').value) > 0 &&
    !(current.kind === 'domain' && current.status !== 2) &&
    !(current.kind === 'address' && current.verdict === VERDICT.Frozen)
  $('payBtn').disabled = !ok
  const instant = current && ((current.kind === 'domain' && current.status === 2) || current.verdict === VERDICT.Verified)
  $('payBtn').textContent = instant ? 'Pay now' : 'Send with 10-minute undo'
}

async function ensureAllowance(amount) {
  const allowance = await pub.readContract({ address: tokenAddr(), abi: erc20Abi, functionName: 'allowance', args: [account, cfg.safeSend] })
  if (allowance >= amount) return
  msg('payMsg', `Approving ${tokenSym()} once for VerifyPay…`)
  await write({ address: tokenAddr(), abi: erc20Abi, functionName: 'approve', args: [cfg.safeSend, maxUint256] })
}

$('payBtn').addEventListener('click', async () => {
  try {
    const amount = parseUnits($('amount').value, 6) // USDC/EURC ERC-20 interface: 6 decimals
    await ensureAllowance(amount)
    const ref = keccak256(toBytes(`vp:${Date.now()}`))
    msg('payMsg', 'Confirm in your wallet…')
    if (current.kind === 'domain') {
      const { hash } = await write({ address: cfg.safeSend, abi: safeAbi, functionName: 'payByName', args: [tokenAddr(), current.domainHash, amount, ref] })
      msg('payMsg', `Paid ${current.target} instantly. ${txLink(hash)}`)
    } else {
      const { hash, receipt } = await write({ address: cfg.safeSend, abi: safeAbi, functionName: 'send', args: [tokenAddr(), current.target, amount, ref] })
      const esc = receipt.logs.map((l) => { try { return decodeEventLog({ abi: safeAbi, ...l }) } catch { return null } }).find((x) => x?.eventName === 'Escrowed')
      if (esc) {
        savePending(esc.args.id)
        msg('payMsg', `Held for 10 minutes. You can still undo it. ${txLink(hash)} <a href="#" id="goUndo">Open undo window →</a>`)
        $('goUndo').onclick = (ev) => { ev.preventDefault(); document.querySelector('[data-tab=pending]').click() }
      } else msg('payMsg', `Paid. ${txLink(hash)}`)
    }
  } catch (e) { msg('payMsg', errText(e), true) }
})

// ---------- Undo window ----------
const pendKey = () => `vp:pending:${cfg.safeSend}`
const loadPending = () => { try { return JSON.parse(localStorage.getItem(pendKey()) || '[]') } catch { return [] } }
const savePending = (id) => { try { localStorage.setItem(pendKey(), JSON.stringify([...new Set([...loadPending(), id.toString()])])) } catch {} }

let timer
async function renderPending() {
  clearInterval(timer)
  const ids = loadPending()
  if (!ids.length) { $('pendingList').innerHTML = '<p class="sub">No held payments.</p>'; return }
  const rows = await Promise.all(ids.map(async (id) => [id, await pub.readContract({ address: cfg.safeSend, abi: safeAbi, functionName: 'pendings', args: [BigInt(id)] })]))
  const draw = () => {
    const now = Math.floor(Date.now() / 1000)
    $('pendingList').innerHTML = rows.reverse().map(([id, p]) => {
      const [, sender, to, amount, releaseAt, reason, open] = p
      const left = Number(releaseAt) - now
      const tok = p[0].toLowerCase() === cfg.eurc.toLowerCase() ? 'EURC' : 'USDC'
      const label = reason === 1 ? '⚠ look-alike' : 'first-time'
      const mine = account && sender.toLowerCase() === account.toLowerCase()
      const action = !open ? '<span class="sub">Settled</span>'
        : left > 0 ? (mine ? `<button data-undo="${id}">Undo (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})</button>` : `<span class="sub">${left}s left</span>`)
          : `<button data-release="${id}">Release to recipient</button>`
      return `<div class="card row"><div><b>${formatUnits(amount, 6)} ${tok}</b> → <span class="mono">${short(to)}</span> <span class="sub">(${label})</span></div>${action}</div>`
    }).join('')
    rows.reverse()
    document.querySelectorAll('[data-undo]').forEach((b) => b.onclick = () => act('cancel', b.dataset.undo))
    document.querySelectorAll('[data-release]').forEach((b) => b.onclick = () => act('release', b.dataset.release))
  }
  draw()
  timer = setInterval(draw, 1000)
}
async function act(fn, id) {
  try { const { hash } = await write({ address: cfg.safeSend, abi: safeAbi, functionName: fn, args: [BigInt(id)] }); alert(`${fn === 'cancel' ? 'Undone: funds returned' : 'Released'} (${hash})`); renderPending() }
  catch (e) { alert(errText(e)) }
}

// ---------- History shield ----------
$('scanBtn').addEventListener('click', async () => {
  if (!account) return alert('Connect your wallet first')
  $('scanList').innerHTML = '<p class="sub">Scanning…</p>'
  try {
    const r = await (await fetch(`/api/history-scan?address=${account}`)).json()
    if (r.error) throw new Error(r.error)
    $('scanList').innerHTML = r.attempts.length
      ? r.attempts.map((a) => `<div class="card"><b class="bad">⚠ Poisoning attempt</b><div class="mono">${highlightDiff(a.poisoned, a.imitates)}</div>${txLink(a.txHash)}</div>`).join('')
      : `<p class="sub">No poisoning attempts found across ${r.realCounterparties.length} real counterparties.</p>`
  } catch (e) { $('scanList').innerHTML = `<p class="msg err">${errText(e)}</p>` }
})

// ---------- Business ----------
function updateTxt() { const d = $('bizDomain').value.trim() || '<your-domain>'; $('txtRecord').textContent = account ? `_verifypay.${d}  TXT  "arc:${account}"` : 'Connect a wallet first' }
$('bizDomain').addEventListener('input', () => { updateTxt(); renderBiz() })
$('copyTxt').addEventListener('click', () => navigator.clipboard?.writeText($('txtRecord').textContent))
$('registerBtn').addEventListener('click', async () => {
  try {
    const d = $('bizDomain').value.trim()
    if (!isDomain(d)) throw new Error('Enter a lowercase domain like acme.com')
    const { hash } = await write({ address: cfg.registry, abi: registryAbi, functionName: 'requestRegistration', args: [d] })
    msg('bizMsg', `Requested. Chainlink CRE will verify the DNS record. ${txLink(hash)}`)
    renderBiz()
  } catch (e) { msg('bizMsg', errText(e), true) }
})

async function renderBiz() {
  const d = $('bizDomain').value.trim()
  if (!isDomain(d)) { $('bizStatus').textContent = '–'; return }
  const p = await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: 'getPayee', args: [keccak256(toBytes(d))] })
  const now = Math.floor(Date.now() / 1000)
  let html = `<b>${STATUS[p.status]}</b>${p.status >= 2 ? ` · payout ${short(p.payout)} · verified ${new Date(Number(p.verifiedAt) * 1000).toLocaleString()}` : ''}`
  if (p.pendingController !== '0x0000000000000000000000000000000000000000') html += `<br/>⚠ DNS now points to ${short(p.pendingController)}; it can take over after ${new Date(Number(p.controllerEta) * 1000).toLocaleString()} unless you cancel.`
  $('bizStatus').innerHTML = html
  const box = $('changeBox')
  if (p.pendingPayout !== '0x0000000000000000000000000000000000000000') {
    const left = Number(p.payoutEta) - now
    box.innerHTML = `<p>Pending payout change to <span class="mono">${short(p.pendingPayout)}</span>: ${left > 0 ? `${left}s left (payments still go to the old wallet)` : 'ready'}</p>
      <button id="execChange" ${left > 0 ? 'disabled' : ''}>Execute change</button> <button id="cancelChange">Cancel (old wallet)</button>`
    $('execChange').onclick = async () => { try { await write({ address: cfg.registry, abi: registryAbi, functionName: 'executePayoutChange', args: [keccak256(toBytes(d))] }); renderBiz() } catch (e) { msg('bizMsg', errText(e), true) } }
    $('cancelChange').onclick = async () => { try { await write({ address: cfg.registry, abi: registryAbi, functionName: 'cancelPayoutChange', args: [keccak256(toBytes(d))] }); renderBiz() } catch (e) { msg('bizMsg', errText(e), true) } }
  } else box.innerHTML = ''
}

// World ID Agent Pass: backend runs the device flow and validates the ID token; we only show the code.
async function agentPass(action, params, boxId) {
  const box = $(boxId)
  const start = await (await fetch('/api/agent-pass/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, params }) })).json()
  if (start.error) throw new Error(start.error)
  const link = start.verificationUriComplete || start.verificationUri
  box.innerHTML = `<div class="card">Open <a href="${link}" target="_blank" rel="noopener">${link}</a> in World App${start.userCode ? ` and enter <b class="mono">${start.userCode}</b>` : ''}. Waiting for you…</div>`
  for (;;) {
    await new Promise((r) => setTimeout(r, (start.interval || 5) * 1000))
    const r = await (await fetch('/api/agent-pass/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: start.sessionId }) })).json()
    if (r.status === 'pending') continue
    if (r.status === 'approved') { box.innerHTML = '<div class="card">✔ Verified by World ID</div>'; return r.result }
    box.innerHTML = `<div class="card">✖ Not approved (${r.status}${r.error ? `: ${r.error}` : ''}). Nothing changed.</div>`
    return null
  }
}

$('changeBtn').addEventListener('click', async () => {
  try {
    const d = $('bizDomain').value.trim(); const np = $('newPayout').value.trim()
    if (!isDomain(d) || !isAddress(np)) throw new Error('Enter your domain and a valid new payout address')
    const domainHash = keccak256(toBytes(d))
    const approval = await agentPass('payoutChange', { domainHash, newPayout: np }, 'agentPassBox')
    if (!approval) return
    const { hash } = await write({ address: cfg.registry, abi: registryAbi, functionName: 'requestPayoutChange', args: [domainHash, np, BigInt(approval.deadline), approval.signature] })
    msg('bizMsg', `Change queued behind the public delay. ${txLink(hash)}`)
    renderBiz()
  } catch (e) { msg('bizMsg', errText(e), true) }
})

// ---------- Agent wallet ----------
async function renderAgent() {
  if (!cfg.agentWallet) { $('agentInfo').textContent = 'AGENT_WALLET_ADDRESS not configured'; return }
  const [lim, spent, agent, owner, bal] = await Promise.all([
    pub.readContract({ address: cfg.agentWallet, abi: walletAbi, functionName: 'limits', args: [tokenAddr()] }),
    pub.readContract({ address: cfg.agentWallet, abi: walletAbi, functionName: 'spentToday', args: [tokenAddr()] }),
    pub.readContract({ address: cfg.agentWallet, abi: walletAbi, functionName: 'agent' }),
    pub.readContract({ address: cfg.agentWallet, abi: walletAbi, functionName: 'owner' }),
    pub.readContract({ address: tokenAddr(), abi: erc20Abi, functionName: 'balanceOf', args: [cfg.agentWallet] }),
  ])
  $('agentInfo').innerHTML = `Wallet <span class="mono">${short(cfg.agentWallet)}</span> · balance ${formatUnits(bal, 6)} ${tokenSym()}<br/>
    Agent <span class="mono">${short(agent)}</span> · owner <span class="mono">${short(owner)}</span><br/>
    Limits: ${formatUnits(lim[0], 6)} per payment, ${formatUnits(lim[1], 6)} per day · spent today ${formatUnits(spent, 6)}`
}
$('raiseBtn').addEventListener('click', async () => {
  try {
    const perPayment = parseUnits($('perPayment').value || '0', 6), perDay = parseUnits($('perDay').value || '0', 6)
    const approval = await agentPass('raiseLimits', { wallet: cfg.agentWallet, token: tokenAddr(), perPayment: perPayment.toString(), perDay: perDay.toString() }, 'raiseBox')
    if (!approval) return
    const { hash } = await write({ address: cfg.agentWallet, abi: walletAbi, functionName: 'raiseLimits', args: [tokenAddr(), perPayment, perDay, BigInt(approval.deadline), approval.signature] })
    msg('agentMsg', `Limits raised. ${txLink(hash)}`)
    renderAgent()
  } catch (e) { msg('agentMsg', errText(e), true) }
})
$('token').addEventListener('change', () => { checkRecipient(); renderAgent().catch(() => {}) })
