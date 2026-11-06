import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBindings } from '../src/bindings.js'

const tmpFile = async () => join(await mkdtemp(join(tmpdir(), 'vp-bind-')), 'data', 'bindings.json')

test('first human binds, same human passes, a different human is refused', async () => {
  const b = createBindings(await tmpFile())
  assert.equal(await b.bindOrCheck('payout:0xaa', 'sub-1'), 'new')
  assert.equal(await b.bindOrCheck('payout:0xaa', 'sub-1'), 'same')
  assert.equal(await b.bindOrCheck('payout:0xaa', 'sub-2'), 'different')
  assert.equal(await b.get('payout:0xaa'), 'sub-1')
})
test('bindings survive a restart (new instance, same file)', async () => {
  const file = await tmpFile()
  await createBindings(file).bindOrCheck('wallet:0xbb', 'sub-9')
  assert.equal(await createBindings(file).bindOrCheck('wallet:0xbb', 'sub-other'), 'different')
})
test('two simultaneous humans cannot both claim the same key', async () => {
  const b = createBindings(await tmpFile())
  const results = await Promise.all([b.bindOrCheck('k', 'a'), b.bindOrCheck('k', 'b')])
  assert.deepEqual(results.sort(), ['different', 'new'])
})
test('a corrupt store is an error, never silently reset', async () => {
  const file = await tmpFile()
  await createBindings(file).bindOrCheck('k', 'a')
  await writeFile(file, '{not json')
  await assert.rejects(() => createBindings(file).bindOrCheck('k', 'b'), /corrupt/)
})
