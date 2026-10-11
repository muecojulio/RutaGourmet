/**
 * Small in-process cache for the public map/weather/wiki calls made by server
 * functions: LRU-bounded entries with a fresh TTL and a longer stale window.
 *
 * `resolve()` implements stale-while-revalidate with single-flight: a stale
 * entry answers immediately (fast UI, happy public endpoints) while ONE
 * background refresh runs; concurrent callers of the same key share it.
 */

export type CacheStats = { entries: number; hits: number; staleHits: number; misses: number };

export class TtlCache {
  private map = new Map<string, { at: number; data: unknown }>();
  private inflight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private staleHits = 0;
  private misses = 0;
  private readonly maxEntries: number;

  constructor(maxEntries = 120) {
    this.maxEntries = maxEntries;
  }

  /** Fresh value, or null. Access bumps the entry (LRU). */
  get<T>(key: string, maxAgeMs: number): T | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > maxAgeMs) return null;
    this.map.delete(key);
    this.map.set(key, hit); // move to the back = most recently used
    this.hits += 1;
    return hit.data as T;
  }

  /** Value regardless of age (the "stale" half of stale-while-revalidate). */
  peek<T>(key: string, maxAgeMs: number): T | null {
    const hit = this.map.get(key);
    if (!hit || Date.now() - hit.at > maxAgeMs) return null;
    this.map.delete(key);
    this.map.set(key, hit);
    this.staleHits += 1;
    return hit.data as T;
  }

  set(key: string, data: unknown): void {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { at: Date.now(), data });
  }

  /**
   * Fresh → return it. Stale → return it and refresh in the background (one
   * flight per key). Nothing → await the load and cache the outcome.
   */
  async resolve<T>(options: {
    key: string;
    ttlMs: number;
    staleMs: number;
    load: () => Promise<T>;
  }): Promise<T> {
    const { key, ttlMs, staleMs, load } = options;
    const fresh = this.get<T>(key, ttlMs);
    if (fresh !== null) return fresh;

    const stale = this.peek<T>(key, staleMs);
    if (stale !== null) {
      this.refreshInBackground(key, load);
      return stale;
    }

    this.misses += 1;
    const loaded = await this.flight(key, load);
    this.set(key, loaded);
    return loaded;
  }

  private refreshInBackground(key: string, load: () => Promise<unknown>): void {
    void this.flight(key, load)
      .then((data) => this.set(key, data))
      .catch(() => {
        // Stale answer already went out; a later call can retry.
      });
  }

  /** One load per key at a time; failures clear the slot so the next call retries. */
  private flight<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = load().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  stats(): CacheStats {
    return {
      entries: this.map.size,
      hits: this.hits,
      staleHits: this.staleHits,
      misses: this.misses,
    };
  }
}
