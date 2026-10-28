import test from "node:test";
import assert from "node:assert/strict";
import { checkRoastLimit, networkAddress, ADMIT_SCRIPT } from "../lib/roast-guard.ts";

const env = {
  VERCEL: "1", NODE_ENV: "production",
  UPSTASH_REDIS_REST_URL: "https://test-only.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-only-token",
  ROAST_RATE_LIMIT_SECRET: "test-only-secret-at-least-32-characters",
};
const headers = new Headers({ "x-vercel-forwarded-for": "192.0.2.10" });
const reply = result => async () => Response.json({ result });

test("Vercel KV variables work without duplicate Upstash variables", async () => {
  const kv = { ...env, UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "",
    KV_REST_API_URL: "https://marketplace.upstash.io", KV_REST_API_TOKEN: "test-only-write-token" };
  let calls = 0;
  assert.equal(await checkRoastLimit(headers, kv, async (url, options) => {
    calls++;
    assert.equal(String(url), kv.KV_REST_API_URL + "/");
    assert.equal(options.headers.Authorization, `Bearer ${kv.KV_REST_API_TOKEN}`);
    return Response.json({ result: [0, 0] });
  }), null);
  assert.equal(calls, 1);
});

test("explicit Upstash credentials take precedence as a complete pair", async () => {
  assert.equal(await checkRoastLimit(headers, { ...env,
    KV_REST_API_URL: "https://other.upstash.io", KV_REST_API_TOKEN: "other-test-token" }, async (url, options) => {
    assert.equal(String(url), env.UPSTASH_REDIS_REST_URL + "/");
    assert.equal(options.headers.Authorization, `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`);
    return Response.json({ result: [0, 0] });
  }), null);
});

test("partial pairs and a read-only KV token cannot enable generation", async () => {
  const kv = { ...env, UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined,
    KV_REST_API_URL: "https://marketplace.upstash.io", KV_REST_API_TOKEN: "test-only-write-token" };
  for (const change of [
    { UPSTASH_REDIS_REST_URL: "https://explicit.upstash.io" },
    { UPSTASH_REDIS_REST_TOKEN: "explicit-test-token" },
    { KV_REST_API_TOKEN: undefined, KV_REST_API_READ_ONLY_TOKEN: "test-only-read-token" },
    { KV_REST_API_URL: undefined },
  ]) {
    const result = await checkRoastLimit(headers, { ...kv, ...change }, () => assert.fail("must not call Redis"));
    assert.equal(result.status, 503);
  }
});

test("canonical addresses share a quota, including IPv6 /64 and mapped IPv4", () => {
  assert.equal(networkAddress("2001:db8:abcd:1234::1"), networkAddress("2001:0db8:abcd:1234:ffff::123"));
  assert.notEqual(networkAddress("2001:db8:abcd:1234::1"), networkAddress("2001:db8:abcd:1235::1"));
  assert.equal(networkAddress("::ffff:192.0.2.10"), networkAddress("192.0.2.10"));
  for (const ip of ["", "unknown", "192.0.2.10, 192.0.2.11", "not-an-ip"]) assert.throws(() => networkAddress(ip));
});

test("admission submits one atomic command with private keys and bounded windows", async () => {
  let command;
  const result = await checkRoastLimit(headers, env, async (url, options) => {
    assert.equal(String(url), env.UPSTASH_REDIS_REST_URL + "/");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    command = JSON.parse(options.body);
    return Response.json({ result: [0, 0] });
  });
  assert.equal(result, null);
  assert.deepEqual(command.slice(0, 3), ["EVAL", ADMIT_SCRIPT, 4]);
  assert.deepEqual(command.slice(7, 11), [20000, 8, 20, 200]);
  assert.ok(!JSON.stringify(command).includes("192.0.2.10"));
  assert.ok(!JSON.stringify(command).includes(env.ROAST_RATE_LIMIT_SECRET));
});

test("headers that callers can spoof are ignored", async () => {
  const keys = [];
  for (const spoof of ["198.51.100.1", "198.51.100.2"]) {
    const h = new Headers(headers); h.set("x-forwarded-for", spoof); h.set("x-real-ip", spoof);
    await checkRoastLimit(h, env, async (_, opts) => {
      keys.push(JSON.parse(opts.body).slice(3, 7)); return Response.json({ result: [0, 0] });
    });
  }
  assert.deepEqual(keys[0], keys[1]);
});

test("shared store rejection returns cooldown and site cap messages", async () => {
  const cooldown = await checkRoastLimit(headers, env, reply([1, 20]));
  assert.equal(cooldown.status, 429); assert.equal(cooldown.retryAfter, 20);
  assert.match(cooldown.error, /20 seconds/);
  const cap = await checkRoastLimit(headers, env, reply([2, 3600]));
  assert.equal(cap.status, 429); assert.match(cap.error, /Today's roast limit/);
});

test("missing credentials, invalid limits and unknown proxy fail closed without network calls", async () => {
  for (const change of [
    { UPSTASH_REDIS_REST_TOKEN: "" }, { UPSTASH_REDIS_REST_URL: "https://example.com" },
    { ROAST_RATE_LIMIT_SECRET: "short" }, { ROAST_HOURLY_LIMIT: "0" },
    { ROAST_GLOBAL_DAILY_LIMIT: "Infinity" }, { ROAST_COOLDOWN_SECONDS: "-1" },
    { VERCEL: "0" },
  ]) {
    let calls = 0;
    const result = await checkRoastLimit(headers, { ...env, ...change }, async () => { calls++; throw Error(); });
    assert.equal(result.status, 503); assert.equal(calls, 0);
  }
  const missingAddress = await checkRoastLimit(new Headers({ "x-forwarded-for": "192.0.2.10" }), env, () => assert.fail("must not call Redis"));
  assert.equal(missingAddress.status, 503);
});

test("outages and malformed store replies never admit a roast", async () => {
  const senders = [
    async () => { throw new Error("timeout"); }, async () => new Response("error", { status: 500 }),
    async () => new Response("not JSON"), async () => Response.json({ error: "ERR" }),
    ...[null, [], [0, -1], [0, 1], [1, 0], [1, 86401], [3, 1], [1, "20"], [0, 0, 1]].map(reply),
  ];
  for (const send of senders) assert.equal((await checkRoastLimit(headers, env, send)).status, 503);
});

test("kill switch avoids all store calls", async () => {
  const result = await checkRoastLimit(headers, { ROASTS_ENABLED: "false" }, () => assert.fail("must not call Redis"));
  assert.equal(result.status, 503); assert.match(result.error, /paused/);
});

test("global key stays shared across IPs and deployments", async () => {
  const keys = [];
  for (const ip of ["192.0.2.1", "192.0.2.2"]) {
    await checkRoastLimit(new Headers({ "x-vercel-forwarded-for": ip }), env, async (_, opts) => {
      keys.push(JSON.parse(opts.body).slice(3, 7)); return Response.json({ result: [0, 0] });
    });
  }
  assert.notEqual(keys[0][0], keys[1][0]); assert.equal(keys[0][3], keys[1][3]);
});
