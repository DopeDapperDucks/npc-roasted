import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Exercise the real handler and guard without installing Next/Sharp. Only the
// framework Response wrapper and image decoder are substituted; no paid calls.
const guardURL = new URL("../lib/roast-guard.ts", import.meta.url).href;
const source = readFileSync(new URL("../app/api/roast/route.ts", import.meta.url), "utf8")
  .replace('import { NextRequest, NextResponse } from "next/server";', 'const NextResponse = Response;')
  .replace('import sharp from "sharp";', 'const sharp = () => { throw new Error("Unexpected image processing"); };')
  .replace('"../../../lib/roast-guard"', JSON.stringify(guardURL));
const compiled = stripTypeScriptTypes(source);
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function request(body, contentType = "application/json") {
  return new Request("https://test.invalid/api/roast", {
    method: "POST", headers: { "content-type": contentType, "x-vercel-forwarded-for": "192.0.2.10" }, body,
  });
}
const valid = JSON.stringify({ tokenId: "1", collection: "npc", level: "Mild" });

test("bad requests never reach shared storage or paid APIs", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => assert.fail("Unexpected upstream request");
  try {
    for (const [body, type, status] of [
      [valid, "text/plain", 415], ["{", "application/json", 400],
      ["null", "application/json", 400], ["[]", "application/json", 400],
      [" ".repeat(2049), "application/json", 413],
      [JSON.stringify({ tokenId: "1", collection: "__proto__", level: "Mild" }), "application/json", 400],
    ]) assert.equal((await POST(request(body, type))).status, status);
  } finally { globalThis.fetch = previous; }
});

test("429 and protection failures stop before OpenSea/OpenAI", async () => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    OPENAI_API_KEY: "test-only", OPENSEA_API_KEY: "test-only", VERCEL: "1",
    UPSTASH_REDIS_REST_URL: "https://test-only.upstash.io", UPSTASH_REDIS_REST_TOKEN: "test-only",
    ROAST_RATE_LIMIT_SECRET: "test-only-secret-at-least-32-characters", ROASTS_ENABLED: "true",
  });
  try {
    for (const result of [[1, 20], [2, 86400], null]) {
      let calls = 0;
      globalThis.fetch = async (url) => {
        calls++;
        assert.equal(new URL(url).hostname, "test-only.upstash.io");
        return Response.json({ result });
      };
      const response = await POST(request(valid));
      assert.equal(response.status, result ? 429 : 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("retry-after"), String(result ? result[1] : 60));
      assert.equal(calls, 1);
      assert.equal(typeof (await response.json()).error, "string");
    }
    process.env.ROASTS_ENABLED = "false";
    globalThis.fetch = () => assert.fail("Kill switch must stop all upstream calls");
    assert.equal((await POST(request(valid))).status, 503);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});
