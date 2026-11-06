import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fingerprint, scanHistory } from '../src/poisoning.js'

const me = '0x1111111111111111111111111111111111111111'
const acme = '0x8f4a00000000000000000000000000000000_91b2'.replace('_', '')
const poison = '0x8f4adeadbeefdeadbeefdeadbeefdeadbeef91b2'

test('fingerprint = first 4 + last 4 hex', () => {
  assert.equal(fingerprint(acme), '8f4a91b2')
  assert.equal(fingerprint(poison), fingerprint(acme))
})

test('flags incoming zero-value transfer from a look-alike of a real counterparty', () => {
  const r = scanHistory(me, [
    { from: me, to: acme, value: '500000000', token: 'usdc', txHash: '0xa' },
    { from: poison, to: me, value: '0', token: 'usdc', txHash: '0xb' },
  ])
  assert.equal(r.attempts.length, 1)
  assert.equal(r.attempts[0].poisoned, poison)
  assert.equal(r.attempts[0].imitates, acme)
})

test('flags fake "sent by you" zero-value transfer to a look-alike', () => {
  const r = scanHistory(me, [
    { from: me, to: acme, value: '1000000', token: 'usdc', txHash: '0xa' },
    { from: me, to: poison, value: '0', token: 'usdc', txHash: '0xc' },
  ])
  assert.equal(r.attempts.length, 1)
})

test('ignores normal payments and unrelated dust', () => {
  const r = scanHistory(me, [
    { from: me, to: acme, value: '1000000', token: 'usdc', txHash: '0xa' },
    { from: '0x2222222222222222222222222222222222222222', to: me, value: '0', token: 'usdc', txHash: '0xd' },
  ])
  assert.equal(r.attempts.length, 0)
})

test('zero-value poisoning seen only in raw Transfer logs is caught after merging with explorer data', async () => {
  const { fromTransferLogs, mergeTransfers } = await import('../src/poisoning.js')
  // The explorer list shows the real payment but omits the zero-value transferFrom (Arc explorer behaviour).
  const explorer = [{ from: me, to: acme, value: '1000000', token: 'usdc', txHash: '0xa' }]
  const logs = fromTransferLogs([
    { address: 'usdc', transactionHash: '0xa', args: { from: me, to: acme, value: 1000000n } }, // duplicate of the explorer row
    { address: 'usdc', transactionHash: '0xp', args: { from: me, to: poison, value: 0n } },
  ])
  const merged = mergeTransfers(explorer, logs)
  assert.equal(merged.length, 2)
  const r = scanHistory(me, merged)
  assert.equal(r.attempts.length, 1)
  assert.equal(r.attempts[0].poisoned, poison)
  assert.equal(r.attempts[0].imitates, acme)
  assert.equal(r.attempts[0].txHash, '0xp')
})
