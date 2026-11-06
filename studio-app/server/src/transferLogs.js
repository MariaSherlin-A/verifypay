// Reads ERC-20 Transfer logs to and from one account straight from the chain.
// Why: the Arc explorer's token-transfer list leaves out zero-value transfers, and a zero-value
// transferFrom(victim, lookalike, 0) is exactly how address poisoning plants a fake row in a history.
import { parseAbiItem } from 'viem'

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
// viem reports a throttled call as "HTTP request failed" with status 429; the "rate limit exceeded" text is in `details`.
const isRateLimit = (e) =>
  e?.status === 429 || /rate limit|-32005|too many requests/i.test([e?.message, e?.shortMessage, e?.details].join(' '))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Retries only rate-limit errors, with growing pauses. Any other error is real and is thrown. */
async function withRetry(fn, tries = 6) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!isRateLimit(e) || i >= tries - 1) throw e
      await sleep(1000 * 2 ** i)
    }
  }
}

/**
 * @param {import('viem').PublicClient} client
 * @param {{ account: string, tokens: string[], lookbackBlocks?: bigint, chunk?: bigint, gapMs?: number }} o
 * @returns {Promise<{ logs: object[], fromBlock: bigint, toBlock: bigint }>}
 *   chunk defaults to 10,000 blocks: the Arc RPC rejects larger log ranges.
 */
export async function fetchTransferLogs(client, { account, tokens, lookbackBlocks = 200_000n, chunk = 10_000n, gapMs = 300 }) {
  const toBlock = await withRetry(() => client.getBlockNumber())
  const fromBlock = toBlock > lookbackBlocks ? toBlock - lookbackBlocks : 0n
  const logs = []
  // Sequential with a small gap: the public Arc RPC answers bursts with "rate limit exceeded".
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - 1n < toBlock ? start + chunk - 1n : toBlock
    for (const args of [{ from: account }, { to: account }]) {
      const part = await withRetry(() =>
        client.getLogs({ address: tokens, event: TRANSFER, args, fromBlock: start, toBlock: end }),
      )
      logs.push(...part)
      await sleep(gapMs)
    }
  }
  return { logs, fromBlock, toBlock }
}
