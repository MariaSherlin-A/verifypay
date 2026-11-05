// World ID Agent Pass: OIDC discovery + ID-token validation, zero dependencies (node:crypto).
// Endpoints are read from the issuer's discovery document, never hard-coded.
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

const b64urlJson = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))

export async function discover(issuer, fetchImpl = fetch) {
  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`OIDC discovery failed: HTTP ${res.status} at ${url}`)
  const doc = await res.json()
  for (const k of ['issuer', 'token_endpoint', 'jwks_uri']) {
    if (!doc[k]) throw new Error(`OIDC discovery missing ${k}`)
  }
  return doc
}

export async function fetchJwks(jwksUri, fetchImpl = fetch) {
  const res = await fetchImpl(jwksUri)
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`)
  const { keys } = await res.json()
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('JWKS has no keys')
  return keys
}

const ALGS = {
  RS256: { hash: 'sha256', kty: 'RSA' },
  RS384: { hash: 'sha384', kty: 'RSA' },
  RS512: { hash: 'sha512', kty: 'RSA' },
  PS256: { hash: 'sha256', kty: 'RSA', pss: true },
  ES256: { hash: 'sha256', kty: 'EC', ec: true },
  ES384: { hash: 'sha384', kty: 'EC', ec: true },
  EdDSA: { hash: null, kty: 'OKP' },
}

/**
 * Validate an ID token. Throws with a precise reason on any failure.
 * @param {string} token
 * @param {{ issuer: string, clientId: string, jwks: object[], notBefore?: number, nonce?: string, now?: number, skew?: number }} o
 *   notBefore: unix seconds; the user must have authenticated at or after this time (fresh verification).
 */
export function validateIdToken(token, o) {
  const now = o.now ?? Math.floor(Date.now() / 1000)
  const skew = o.skew ?? 60
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('malformed token')
  const header = b64urlJson(parts[0])
  const claims = b64urlJson(parts[1])

  const alg = ALGS[header.alg]
  if (!alg) throw new Error(`unsupported alg ${header.alg}`) // rejects "none"
  const candidates = o.jwks.filter((k) => (!header.kid || k.kid === header.kid) && k.kty === alg.kty)
  if (candidates.length === 0) throw new Error('no matching JWK')
  const data = Buffer.from(`${parts[0]}.${parts[1]}`)
  const sig = Buffer.from(parts[2], 'base64url')
  const ok = candidates.some((jwk) => {
    const key = createPublicKey({ key: jwk, format: 'jwk' })
    const opts = alg.ec ? { key, dsaEncoding: 'ieee-p1363' } : alg.pss ? { key, padding: 6, saltLength: 32 } : key
    return cryptoVerify(alg.hash, data, opts, sig)
  })
  if (!ok) throw new Error('bad signature')

  if (claims.iss !== o.issuer) throw new Error(`bad iss ${claims.iss}`)
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(o.clientId)) throw new Error('bad aud')
  if (aud.length > 1 && claims.azp && claims.azp !== o.clientId) throw new Error('bad azp')
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new Error('expired')
  if (typeof claims.iat === 'number' && claims.iat - skew > now) throw new Error('issued in the future')
  if (o.nonce !== undefined && claims.nonce !== undefined && claims.nonce !== o.nonce) throw new Error('bad nonce')
  if (o.notBefore !== undefined) {
    const authTime = claims.auth_time ?? claims.iat
    if (typeof authTime !== 'number' || authTime + skew < o.notBefore) throw new Error('not a fresh verification')
  }
  if (!claims.sub) throw new Error('missing sub')
  return claims
}

/**
 * Client authentication for World's endpoints (RFC 6749 §2.3.1). World fixes the method at app registration:
 * 'basic' (default) = HTTP Basic header with url-encoded id:secret; 'post' = client_secret in the form body.
 */
export function clientAuth(body, { clientId, clientSecret, authMethod = 'basic' }) {
  const headers = { 'content-type': 'application/x-www-form-urlencoded' }
  if (!clientSecret) return headers // public client: client_id in the body only
  if (authMethod === 'post') {
    body.set('client_secret', clientSecret)
  } else {
    const cred = `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
    headers.authorization = `Basic ${Buffer.from(cred).toString('base64')}`
  }
  return headers
}

/** RFC 8628 device authorization request. */
export async function startDeviceFlow(discovery, { clientId, clientSecret, scope, authMethod }, fetchImpl = fetch) {
  const ep = discovery.device_authorization_endpoint
  if (!ep) throw new Error('issuer has no device_authorization_endpoint; use the authorization-code flow from the World docs')
  const body = new URLSearchParams({ client_id: clientId, scope: scope || 'openid' })
  const headers = clientAuth(body, { clientId, clientSecret, authMethod })
  const res = await fetchImpl(ep, { method: 'POST', headers, body })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`device authorization failed: ${json.error || res.status}`)
  return json // device_code, user_code, verification_uri, verification_uri_complete?, expires_in, interval?
}

/** One RFC 8628 token poll. Returns {status:'pending'|'slow_down'|'denied'|'expired'|'ok', idToken?, error?} */
export async function pollDeviceToken(discovery, { clientId, clientSecret, deviceCode, authMethod }, fetchImpl = fetch) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: clientId,
  })
  const headers = clientAuth(body, { clientId, clientSecret, authMethod })
  const res = await fetchImpl(discovery.token_endpoint, { method: 'POST', headers, body })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.id_token) return { status: 'ok', idToken: json.id_token }
  switch (json.error) {
    case 'authorization_pending': return { status: 'pending' }
    case 'slow_down': return { status: 'slow_down' }
    case 'access_denied': return { status: 'denied', error: json.error }
    case 'expired_token': return { status: 'expired', error: json.error }
    default: return { status: 'error', error: json.error || `HTTP ${res.status}` }
  }
}
