import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { validateIdToken, pollDeviceToken } from '../src/oidc.js'

const ISS = 'https://auth.world.org'
const CID = 'app_123'
const now = 1_800_000_000

function makeToken(alg, privateKey, kid, claims) {
  const h = Buffer.from(JSON.stringify({ alg, kid, typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const data = Buffer.from(`${h}.${p}`)
  const sig = alg === 'ES256'
    ? cryptoSign('sha256', data, { key: privateKey, dsaEncoding: 'ieee-p1363' })
    : cryptoSign('sha256', data, privateKey)
  return `${h}.${p}.${sig.toString('base64url')}`
}

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const jwks = [
  { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'r1' },
  { ...ec.publicKey.export({ format: 'jwk' }), kid: 'e1' },
]
const good = { iss: ISS, aud: CID, sub: 'world-user-1', iat: now, exp: now + 300, auth_time: now }
const opts = { issuer: ISS, clientId: CID, jwks, now, notBefore: now - 10 }

test('accepts a valid RS256 token', () => {
  assert.equal(validateIdToken(makeToken('RS256', rsa.privateKey, 'r1', good), opts).sub, 'world-user-1')
})
test('accepts a valid ES256 token', () => {
  assert.equal(validateIdToken(makeToken('ES256', ec.privateKey, 'e1', good), opts).sub, 'world-user-1')
})
test('rejects a forged signature', () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
  assert.throws(() => validateIdToken(makeToken('RS256', other.privateKey, 'r1', good), opts), /bad signature/)
})
test('rejects alg none', () => {
  const h = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
  const p = Buffer.from(JSON.stringify(good)).toString('base64url')
  assert.throws(() => validateIdToken(`${h}.${p}.`, opts), /unsupported alg/)
})
test('rejects wrong issuer, audience, expiry', () => {
  assert.throws(() => validateIdToken(makeToken('RS256', rsa.privateKey, 'r1', { ...good, iss: 'https://evil' }), opts), /bad iss/)
  assert.throws(() => validateIdToken(makeToken('RS256', rsa.privateKey, 'r1', { ...good, aud: 'other' }), opts), /bad aud/)
  assert.throws(() => validateIdToken(makeToken('RS256', rsa.privateKey, 'r1', { ...good, exp: now - 3600 }), opts), /expired/)
})
test('rejects a stale (not fresh) verification', () => {
  const stale = { ...good, auth_time: now - 3600 }
  assert.throws(() => validateIdToken(makeToken('RS256', rsa.privateKey, 'r1', stale), opts), /not a fresh/)
})
test('rejects a tampered payload', () => {
  const t = makeToken('RS256', rsa.privateKey, 'r1', good).split('.')
  t[1] = Buffer.from(JSON.stringify({ ...good, sub: 'attacker' })).toString('base64url')
  assert.throws(() => validateIdToken(t.join('.'), opts), /bad signature/)
})
test('device poll maps RFC 8628 errors', async () => {
  const disc = { token_endpoint: 'https://x/token' }
  const mk = (status, body) => async () => ({ ok: status === 200, status, json: async () => body })
  assert.equal((await pollDeviceToken(disc, { clientId: CID, deviceCode: 'd' }, mk(400, { error: 'authorization_pending' }))).status, 'pending')
  assert.equal((await pollDeviceToken(disc, { clientId: CID, deviceCode: 'd' }, mk(400, { error: 'access_denied' }))).status, 'denied')
  assert.equal((await pollDeviceToken(disc, { clientId: CID, deviceCode: 'd' }, mk(400, { error: 'expired_token' }))).status, 'expired')
  assert.equal((await pollDeviceToken(disc, { clientId: CID, deviceCode: 'd' }, mk(200, { id_token: 'x.y.z' }))).status, 'ok')
})
