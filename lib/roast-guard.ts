import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

// One atomic admission across ALL instances/regions. Redis time avoids clock skew.
// Sorted sets enforce rolling windows; rejected requests never extend a lockout.
export const ADMIT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local windows = {3600000, 86400000, 86400000}
local wait = math.max(0, redis.call('PTTL', KEYS[1]))
local reason = 1
for i = 2, 4 do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now - windows[i-1])
  if redis.call('ZCARD', KEYS[i]) >= tonumber(ARGV[i]) then
    local oldest = redis.call('ZRANGE', KEYS[i], 0, 0, 'WITHSCORES')
    wait = math.max(wait, tonumber(oldest[2]) + windows[i-1] - now)
    if i == 4 then reason = 2 end
  end
end
if wait > 0 then return {reason, math.ceil(wait / 1000)} end
redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
for i = 2, 4 do
  redis.call('ZADD', KEYS[i], now, ARGV[5])
  redis.call('PEXPIRE', KEYS[i], windows[i-1])
end
return {0, 0}
`;

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
export type GuardResult = { status: number; error: string; retryAfter: number } | null;

function positive(env: Env, name: string, fallback: number, max: number) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error("Invalid limit configuration");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error("Invalid limit configuration");
  return value;
}

// Canonical IPv4, or an IPv6 /64 so rotating privacy addresses share a quota.
export function networkAddress(ip: string) {
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) throw new Error("Missing trusted client address");
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const parts = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  const words = parts.map(p => parseInt(p, 16));
  if (words.slice(0, 5).every(w => w === 0) && words[5] === 65535) {
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(".");
  }
  return words.slice(0, 4).map(w => w.toString(16)).join(":") + "::/64";
}

export async function checkRoastLimit(headers: Headers, env: Env = process.env, send: Fetch = fetch): Promise<GuardResult> {
  if (env.ROASTS_ENABLED === "false") {
    return { status: 503, error: "Roasts are paused. Please try again later.", retryAfter: 300 };
  }
  try {
    // Treat credentials as a pair: never combine URLs/tokens from two stores.
    const explicit = Boolean(env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN);
    const url = new URL((explicit ? env.UPSTASH_REDIS_REST_URL : env.KV_REST_API_URL) || "");
    const token = explicit ? env.UPSTASH_REDIS_REST_TOKEN : env.KV_REST_API_TOKEN;
    const secret = env.ROAST_RATE_LIMIT_SECRET;
    if (url.protocol !== "https:" || !url.hostname.endsWith(".upstash.io") || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !token || !secret || secret.length < 32) {
      throw new Error("Missing limiter configuration");
    }
    let address: string;
    if (env.VERCEL === "1") {
      // Vercel supplies this header. Do not trust arbitrary forwarded headers
      // when self-hosting; production outside Vercel deliberately fails closed.
      address = networkAddress(headers.get("x-vercel-forwarded-for")?.trim() || "");
    } else if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      address = "local-development";
    } else {
      throw new Error("Unsupported deployment proxy");
    }
    const identity = createHmac("sha256", secret).update(address).digest("hex");
    // Keep this prefix stable across deployments and environments sharing a DB.
    const prefix = "npc-roast:{admission-v1}";
    const keys = [`${prefix}:${identity}:cooldown`, `${prefix}:${identity}:hour`, `${prefix}:${identity}:day`, `${prefix}:global-day`];
    const args = [
      positive(env, "ROAST_COOLDOWN_SECONDS", 20, 3600) * 1000,
      positive(env, "ROAST_HOURLY_LIMIT", 8, 1000),
      positive(env, "ROAST_DAILY_LIMIT", 20, 10000),
      positive(env, "ROAST_GLOBAL_DAILY_LIMIT", 200, 100000),
      randomUUID(),
    ];
    const response = await send(url, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", ADMIT_SCRIPT, keys.length, ...keys, ...args]),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Limiter unavailable");
    const payload = await response.json();
    const result: unknown = payload?.result;
    if (payload?.error || !Array.isArray(result) || result.length !== 2 || ![0, 1, 2].includes(result[0]) || !Number.isSafeInteger(result[1]) || result[1] < 0 || result[1] > 86400 || (result[0] === 0 ? result[1] !== 0 : result[1] < 1)) {
      throw new Error("Invalid limiter response");
    }
    if (result[0] === 0) return null;
    const retryAfter = result[1] as number;
    const error = result[0] === 2
      ? "Today's roast limit has been reached. Please come back later."
      : `You're roasting too quickly or have reached your limit. Try again in ${retryAfter < 60 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`}.`;
    return { status: 429, error, retryAfter };
  } catch {
    // Never fall back to per-process memory or log credentials/request addresses.
    console.error("Roast admission protection unavailable");
    return { status: 503, error: "Roasts are temporarily unavailable. Please try again shortly.", retryAfter: 60 };
  }
}
