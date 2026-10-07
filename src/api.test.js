import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api } from "./api.js";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test("serializes request bodies and reads JSON", async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/noor/students"));
    assert.equal(options.method, "POST");
    assert.equal(options.body, '{"name":"Aisha"}');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('{"id":1}', { headers: { "Content-Type": "application/json" } });
  };
  assert.deepEqual(await api("POST", "/noor/students", { name: "Aisha" }), { id: 1 });
});
test("accepts an empty successful response", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api("POST", "/end"), null);
});
test("does not expose backend error content", async () => {
  globalThis.fetch = async () => new Response("internal stack trace", { status: 500 });
  await assert.rejects(api("GET", "/test"), /Please try again/);
});
test("explains connection failures", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(api("GET", "/test"), /Check your internet connection/);
});
test("explains aborted requests", async () => {
  globalThis.fetch = async () => { throw new DOMException("Aborted", "AbortError"); };
  await assert.rejects(api("GET", "/test"), /taking too long/);
});
