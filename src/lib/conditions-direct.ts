/**
 * Browser-direct transport for Open-Meteo and Wikipedia geosearch.
 *
 * Mirrors `geo-direct.ts`: only reached when the server cannot reach the
 * outside world (sandbox preview with blocked egress). Same URLs and parsers
 * as the server functions (`conditions-core.ts`), same `Ok` shape, with its
 * own small client-side cache so scrolling around doesn't refetch.
 */
import {
  openMeteoUrl,
  weatherFromOpenMeteo,
  wikiFromPayload,
  wikiGeosearchUrl,
  type Ok,
  type Point,
  type WeatherNow,
  type WikiContext,
} from "./conditions-core";

const REQUEST_TIMEOUT_MS = 10_000;
const cache = new Map<string, { at: number; data: unknown }>();

function fromCache<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function remember(key: string, data: unknown): void {
  if (cache.size > 40) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`El servicio público respondió ${response.status}`);
  return response.json();
}

export async function weatherNowDirect(point: Point): Promise<Ok<WeatherNow>> {
  const key = `w:${point.lat.toFixed(2)},${point.lon.toFixed(2)}`;
  const cached = fromCache<WeatherNow>(key, 15 * 60_000);
  if (cached) return { ok: true, data: cached };
  try {
    const weather = weatherFromOpenMeteo(await getJson(openMeteoUrl(point)));
    if (!weather) return { ok: false, error: "No pude leer el clima." };
    remember(key, weather);
    return { ok: true, data: weather };
  } catch {
    return { ok: false, error: "No pude consultar el clima ahora." };
  }
}

export async function wikiContextDirect(point: Point): Promise<Ok<WikiContext>> {
  const key = `k:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
  const cached = fromCache<WikiContext>(key, 60 * 60_000);
  if (cached) return { ok: true, data: cached };
  try {
    const context = wikiFromPayload(await getJson(wikiGeosearchUrl(point)));
    remember(key, context);
    return { ok: true, data: context };
  } catch {
    return { ok: false, error: "Sin historias cerca por ahora." };
  }
}
