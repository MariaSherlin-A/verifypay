// Address-poisoning detection over a payer's token-transfer history.
const norm = (a) => String(a).toLowerCase()

/** First 4 + last 4 hex chars, matching PayeeRegistry.fingerprint(). */
export const fingerprint = (addr) => {
  const a = norm(addr).replace(/^0x/, '')
  return `${a.slice(0, 4)}${a.slice(-4)}`
}

/**
 * @param {string} user payer address
 * @param {{from:string,to:string,value:string|bigint,token:string,txHash:string,timestamp?:string}[]} transfers
 * @param {{dustThreshold?: bigint}} opts value at or below this (atomic units) counts as dust (default 1e4 = 0.01 USDC)
 */
export function scanHistory(user, transfers, opts = {}) {
  const me = norm(user)
  const dust = opts.dustThreshold ?? 10_000n
  // Real counterparties: addresses the user actually sent a non-dust amount to.
  const real = new Map()
  for (const t of transfers) {
    if (norm(t.from) === me && BigInt(t.value) > dust) real.set(norm(t.to), fingerprint(t.to))
  }
  const byFp = new Map()
  for (const [addr, fp] of real) byFp.set(fp, addr)

  const attempts = []
  for (const t of transfers) {
    const from = norm(t.from)
    const to = norm(t.to)
    // Poisoning shows up either as an incoming dust/zero transfer from a look-alike,
    // or as a zero-value transferFrom that makes it look like the user sent to the look-alike.
    const counterparty = to === me ? from : from === me ? to : null
    if (!counterparty || real.has(counterparty)) continue
    if (BigInt(t.value) > dust) continue
    const imitated = byFp.get(fingerprint(counterparty))
    if (imitated && imitated !== counterparty) {
      attempts.push({ poisoned: counterparty, imitates: imitated, txHash: t.txHash, token: t.token, value: String(t.value), timestamp: t.timestamp })
    }
  }
  return { realCounterparties: [...real.keys()], attempts }
}

/**
 * Map raw ERC-20 `Transfer` logs (viem getLogs with the Transfer event) to the shape above.
 * Needed because the Arc explorer's token-transfer list omits zero-value transfers, which is exactly
 * how a `transferFrom(victim, lookalike, 0)` poisoning shows up (verified on Arc Testnet, 2026-11-06).
 */
export const fromTransferLogs = (logs) =>
  (logs || []).map((l) => ({
    from: l.args?.from,
    to: l.args?.to,
    value: String(l.args?.value ?? 0n),
    token: l.address,
    txHash: l.transactionHash,
  }))

/** Union of transfer lists, without duplicates (same tx, token, from, to and value). */
export function mergeTransfers(...lists) {
  const seen = new Set()
  const out = []
  for (const t of lists.flat()) {
    const key = [t.txHash, t.token, t.from, t.to, t.value].map((x) => norm(x ?? '')).join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** Map Blockscout v2 /addresses/{a}/token-transfers items to the shape above. */
export const fromBlockscout = (items) =>
  (items || []).map((i) => ({
    from: i.from?.hash,
    to: i.to?.hash,
    value: i.total?.value ?? '0',
    token: i.token?.address ?? i.token?.address_hash,
    txHash: i.transaction_hash ?? i.tx_hash,
    timestamp: i.timestamp,
  }))
