import assert from "node:assert/strict";
import { test } from "node:test";
import { TtlCache } from "./server-cache.ts";

/** Test handle for aging entries without a fake clock. */
function internal(cache: TtlCache) {
  return cache as unknown as { map: Map<string, { at: number }> };
}

function ageEntry(cache: TtlCache, key: string, ageMs: number) {
  const entry = internal(cache).map.get(key);
  if (entry) entry.at = Date.now() - ageMs;
}

test("resolve: returns fresh values without loading again", async () => {
  const cache = new TtlCache();
  let loads = 0;
  const load = async () => {
    loads += 1;
    return "v1";
  };
  await cache.resolve({ key: "k", ttlMs: 10_000, staleMs: 60_000, load });
  assert.equal(await cache.resolve({ key: "k", ttlMs: 10_000, staleMs: 60_000, load }), "v1");
  assert.equal(loads, 1);
  assert.equal(cache.stats().hits, 1);
});

test("resolve: single-flight — concurrent misses share one load", async () => {
  const cache = new TtlCache();
  let loads = 0;
  const load = async () => {
    loads += 1;
    await new Promise((done) => setTimeout(done, 10));
    return "shared";
  };
  const [a, b, c] = await Promise.all([
    cache.resolve({ key: "k", ttlMs: 10_000, staleMs: 60_000, load }),
    cache.resolve({ key: "k", ttlMs: 10_000, staleMs: 60_000, load }),
    cache.resolve({ key: "k", ttlMs: 10_000, staleMs: 60_000, load }),
  ]);
  assert.equal(a, "shared");
  assert.equal(b, "shared");
  assert.equal(c, "shared");
  assert.equal(loads, 1);
});

test("get/peek: fresh vs stale windows", () => {
  const cache = new TtlCache();
  cache.set("k", "v");
  // Fresh immediately.
  assert.equal(cache.get("k", 1000), "v");
  // Simulate age by rewriting the timestamp.
  ageEntry(cache, "k", 5000);
  assert.equal(cache.get("k", 1000), null);
  assert.equal(cache.peek("k", 60_000), "v");
});

test("set: evicts the least recently used entry at capacity", () => {
  const cache = new TtlCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a", 60_000); // bump "a" — "b" becomes the LRU
  cache.set("c", 3);
  assert.equal(cache.get("a", 60_000), 1);
  assert.equal(cache.get("b", 60_000), null);
  assert.equal(cache.get("c", 60_000), 3);
  assert.equal(cache.stats().entries, 2);
});

test("resolve: a failed background refresh keeps the stale answer served", async () => {
  const cache = new TtlCache();
  cache.set("k", "stale");
  ageEntry(cache, "k", 999_999);
  let calls = 0;
  const result = await cache.resolve({
    key: "k",
    ttlMs: 10,
    staleMs: 999_999_999,
    load: async () => {
      calls += 1;
      throw new Error("network down");
    },
  });
  assert.equal(result, "stale");
  assert.equal(calls, 1);
  assert.ok(cache.stats().staleHits >= 1);
});
