# Roast abuse protection

Status: local implementation for issue #5. Not deployed. Existing website keeps
its previous memory-only limit until this version is approved and released.

## Defaults

| Scope | Limit |
| --- | --- |
| Network address | One admitted request per 20 seconds |
| Network address | Eight admitted requests in a rolling hour |
| Network address | Twenty admitted requests in a rolling 24 hours |
| Entire site | 200 admitted requests in a rolling 24 hours |

All limits apply before OpenSea lookup, image processing and OpenAI generation.
An admitted request consumes quota even if an upstream service later fails;
blocked requests do not consume quota or extend cooldowns. The server sends
HTTP 429 with Retry-After and an error the existing page displays. Invalid JSON
and bodies larger than 2 KB are rejected before admission. No new UI is needed.

One Redis Lua command atomically checks and reserves all quotas using Redis
time. There are no automatic retries or per-instance fallbacks. Missing config,
unexpected replies, or an unavailable store return HTTP 503 and stop paid calls.
The 3-second store timeout can consume a reservation if the command completed
but the reply was lost; deliberately no refund is attempted.

## Setup before release

1. Connect a durable Upstash Redis database to this Vercel project. Use the same
   database and stable secret across production replicas and deployment versions.
   Disable eviction, monitor availability/usage, and restrict database access.
   Clearing/losing quota data resets limits. Separate preview storage can be used
   only with separate test API credentials; previews with production API keys
   must share production quotas.
2. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (write-capable token)
   directly in Vercel environment settings. Set ROAST_RATE_LIMIT_SECRET to a
   separate, randomly generated secret of at least 32 characters. Never put real
   values in code, chat or review artifacts. Local values belong in .env.local.
3. The optional variables and defaults are listed in .env.example. Change
   ROAST_GLOBAL_DAILY_LIMIT to the daily request allowance Boston chooses.
   ROASTS_ENABLED=false pauses new roasts once the configuration is deployed;
   changing Vercel env settings requires a deployment. It does not cancel
   in-flight work. This is not an instant remote emergency switch.
4. Obtain scoped SenzuGod approval, restore the changes onto real upstream git
   history, complete build/TypeScript checks, and deploy an approved preview.
   The local git repo is still the reconstructed snapshot (see LOCAL-SETUP.md).
5. Verify actual Upstash Lua execution, parallel requests, 20-second expiry,
   hourly/daily/global caps and outage behavior using separate test API keys
   or an upstream stub. Confirm blocked requests never reach paid APIs. Verify
   Vercel supplies x-vercel-forwarded-for on the approved preview.
6. After approval and validation, release through a PR with Closes #5 and request
   SenzuDevArc's review. Protect or remove older deployments/previews that still
   expose the old API with working paid credentials; they can bypass this guard.
   Do not leave an unprotected deployment as the rollback target.

## Limits of protection

Network quotas are not per-person accounts: people sharing Wi-Fi share a limit.
IPv6 addresses are grouped by /64; mapped IPv4 addresses use the IPv4 bucket.
Changing networks or using proxies can bypass individual quotas; the shared
site cap still bounds total admitted requests, but an attacker can exhaust it
and temporarily stop other users. This is a request cap, not a dollar guarantee:
model choice, provider pricing, other API clients and existing deployments affect
cost. Add provider spending controls and Vercel firewall/bot protection as an
additional layer if abuse increases. Heavy traffic still uses hosting/Redis
resources even when no roast is admitted.

Only Vercel's platform-supplied client header is accepted in production. Other
production hosting deliberately fails closed until its trusted proxy is designed.
Local development uses a single shared development bucket. Raw IP addresses are
not stored in Redis; an HMAC-derived network ID is used, expiring within 24 hours
after its last admitted request. Treat these IDs as pseudonymous identifiers.

## Validation

With Node 22.14+, run `node --experimental-strip-types --test tests/*.test.mjs`.
Tests execute the guard with mocked Redis HTTP replies and the actual route
with framework/image-library substitutes. They verify fail-closed responses,
input bounds, quota-key privacy, trusted-header handling, address normalization,
and that denied requests cannot reach paid APIs. These tests do not execute Lua
or validate Redis atomicity/expiry. Real Upstash concurrency tests, a full Next
build and deployed browser tests remain release gates.

Implementation references:
- https://vercel.com/docs/headers/request-headers
- https://upstash.com/docs/redis/features/restapi
- https://redis.io/docs/latest/develop/programmability/eval-intro/

## Vercel Marketplace variable compatibility

The guard now accepts the existing KV_REST_API_URL / KV_REST_API_TOKEN pair
created by Vercel’s Upstash integration. No duplicate database variables are
needed. An explicit UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN pair
takes precedence when either explicit setting is nonempty; incomplete explicit
configuration fails closed rather than mixing credentials from different stores.
KV_REST_API_READ_ONLY_TOKEN and REDIS_URL/KV_URL are not used.
ROAST_RATE_LIMIT_SECRET remains required. This compatibility follow-up is local
until its scoped review/publication approval is recorded.
