# NPC Roasted abuse protection — security self-review

Reviewed 2026-10-27 using the team's security-reviewer guide. This is a source
self-review, not independent approval. Tracking issue: #5.

## Checked

- Server-side admission before both paid providers; no frontend-only enforcement.
- Shared atomic Redis Lua command, consistent keys across replicas/deployments,
  Redis server time, expiry and no quota refund/retry that could admit extra work.
- Per-network cooldown/hour/day quotas plus a site cap for distributed abuse.
- Missing/malformed Redis replies, failed requests and invalid config fail closed.
- IP data is HMAC-derived; equivalent IPv6 addresses share a /64 bucket; the
  production identity trusts only Vercel's supplied header on Vercel hosting.
- Actual streamed request size capped at 2 KB; malformed JSON and inherited
  collection property names rejected. Guard secrets stay server-side.
- Common API/private-key pattern scan of tracked source and new files: no matches.
  No real .env files are tracked in the local snapshot. Remote history, hosting
  environment values and credentials were not audited.

## Validation

Ten Node tests pass: address canonicalization, spoofed-header isolation, command
shape/key privacy, shared global key, rejection messages, config failures,
outages/malformed replies, kill switch, route input validation and proof that
denied requests make no OpenSea/OpenAI call. Framework and image-library imports
are substituted in route tests; Redis HTTP replies are mocked. Diff whitespace
check passes. No real paid provider requests were made.

Lua has been reviewed but not executed: actual Redis concurrency/expiry and
Upstash compatibility tests remain required. Full Next build/TypeScript check
and deployed browser/header verification remain required (dependencies/npm and
network access unavailable). A Node 22 runtime bundled with GitHub Desktop was
used for the local tests.

## Remaining risks / release requirements

- HIGH until rollout: the current public code still uses process-local limits.
  Older reachable deployments with working paid credentials can bypass the new
  protection; retire/protect them as part of the approved release.
- MEDIUM: distributed callers can consume the global allowance and deny service
  to real users. IP limits are not identity or bot verification. Firewall/bot
  controls and provider spending controls are additional protections.
- MEDIUM: DB deletion/eviction, using different stores, or secret rotation can
  reset quotas. Disable eviction and keep production configuration stable.
- Availability tradeoff: Redis outages stop new roasts; admitted failures still
  consume quota. People sharing a network share the per-network limits.

Run the team's vet workflow so Senzu can review before this version goes live.
Never paste seed phrases/private keys or commit real .env credentials.
