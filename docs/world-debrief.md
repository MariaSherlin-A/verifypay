# World ID Agent Pass: integration debrief

Project: VerifyPay · Track: World ID Agent Pass · Issuer: `https://auth.world.org`

## What we built
Agent Pass gates the two moments where money gets redirected:
1. A business **changing its payout wallet** (`PayeeRegistry.requestPayoutChange`), the classic invoice-redirection fraud.
2. Raising an **AI agent's spending limit** (`AgentWallet.raiseLimits`).

Flow: OIDC discovery → RFC 8628 **device flow** (QR code + user code) → the backend validates the ID token (RS256
signature from JWKS, `iss`, `aud`, `exp`, and an `auth_time` freshness check) → **same-human binding** on the
pairwise `sub` → the backend signs an **EIP-712 approval** → the contract verifies it, and the change then waits out a
public delay the old wallet can cancel. Lowering limits or pausing never needs World ID.

## Time to first success
- App registered in the World developer portal, then the device flow ran live from the Arc Studio backend: World
  returned a `userCode` and `verificationUriComplete`, and the first poll came back `pending`. One fix was
  needed first: our client sent `client_secret_post`, but the app was registered with
  "Client secret (Basic)". We added `WORLD_CLIENT_AUTH=basic|post` with a unit test.

## Friction encountered
- The client-auth method is chosen once at registration and cannot be changed later, and the token endpoint
  rejects the other method. Our first requests failed until we matched it.
- Discovery lists `acr_values_supported` as only `orb` and `orb-face`, so sign-in needs an Orb-verified World App
  account. On the day, the team member's Orb verification at the venue did not complete, which blocked the
  end-to-end approval in our demo. Everything up to the scan (real QR code and user code) works.

## Missing capability or documentation
- A documented test identity or staging issuer for Agent Pass, so builders can run the full approval without an Orb.
- A clear statement of whether the pairwise `sub` is stable per app, which our same-human binding relies on.

## The one improvement with the greatest impact
A sandbox issuer (or test accounts) for `auth.world.org` that behaves exactly like production. Then the approval
path could be tested end to end in CI and at hackathons.

## Notes from the World booth (fill in after judging)
- Orb verification outcome:
- Answers on `acr`, `auth_time` freshness and pairwise `sub`:
- Any feedback on the device flow vs. authorization code for agents:
