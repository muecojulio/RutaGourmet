/**
 * Browser-direct transport for the public map services.
 *
 * The server functions in `geo.functions.ts` are the default path: they cache
 * and rate-limit in one place and keep the public endpoints off the phone's
 * request log. This module exists for the case where that server cannot reach
 * the outside world (a local/preview sandbox with blocked egress, a proxy) —
 * there the app would look broken, while the phone browsing it has internet.
 *
 * Same endpoints, same parsers (`geo-core.ts`), same `Ok` shape as the server
 * functions, so callers never branch on which transport answered. It is only
 * ever reached as a fallback, never on the happy path.
 */
import {
  crow,
  hitsFromNominatim,
  hitsFromOverpass,
  hitsFromPhoton,
  labelFromReverse,
  nominatimReverseUrl,
  nominatimSearchUrl,
  osrmUrls,
  overpassQuery,
  photonSearchUrl,
  routeFromOsrm,
  OVERPASS_MIRRORS,
  type GeoHit,
  type Ok,
  type Point,
  type RoutePlan,
  type TravelModeId,
} from "./geo-core";

const REQUEST_TIMEOUT_MS = 12_000;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 40;

let windowStart = Date.now();
let windowCount = 0;

function allowRequest(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= WINDOW_LIMIT;
}

const cache = new Map<string, { at: number; data: unknown }>();

function fromCache<T>(key: string, ttl: number): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function remember(key: string, data: unknown) {
  if (cache.size > 60) {
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
  if (!response.ok) throw new Error(`El servicio de mapas respondió ${response.status}`);
  return response.json();
}

async function postForm(url: string, body: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    credentials: "omit",
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`El servicio de mapas respondió ${response.status}`);
  return response.json();
}

/** Photon first, Nominatim as the fallback — same order the server uses. */
export async function searchPlacesDirect(q: string, near?: Point): Promise<Ok<GeoHit[]>> {
  if (!allowRequest()) return { ok: false, error: "Demasiadas búsquedas. Espera un momento." };
  const key = `s:${q.toLowerCase()}:${near ? `${near.lat.toFixed(3)},${near.lon.toFixed(3)}` : "-"}`;
  const cached = fromCache<GeoHit[]>(key, 3 * 60_000);
  if (cached) return { ok: true, data: cached };
  try {
    let hits = hitsFromPhoton(await getJson(photonSearchUrl(q, near)));
    if (hits.length === 0) hits = hitsFromNominatim(await getJson(nominatimSearchUrl(q)));
    remember(key, hits);
    return { ok: true, data: hits };
  } catch {
    return { ok: false, error: "No se pudo buscar ahora. Intenta de nuevo en unos segundos." };
  }
}

export async function nearbyPlacesDirect(point: Point): Promise<Ok<GeoHit[]>> {
  if (!allowRequest()) return { ok: false, error: "Demasiadas búsquedas. Espera un momento." };
  const key = `n:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
  const cached = fromCache<GeoHit[]>(key, 5 * 60_000);
  if (cached) return { ok: true, data: cached };
  const body = `data=${encodeURIComponent(overpassQuery(point))}`;
  try {
    let hits: GeoHit[] = [];
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        hits = hitsFromOverpass(await postForm(mirror, body), point);
        if (hits.length > 0) break;
      } catch {
        // try the next mirror
      }
    }
    if (hits.length === 0) {
      hits = hitsFromPhoton(await getJson(photonSearchUrl("restaurante", point)))
        .filter((hit) => crow(point.lat, point.lon, hit.lat, hit.lon) < 4000)
        .slice(0, 12);
    }
    remember(key, hits);
    return { ok: true, data: hits };
  } catch {
    return { ok: false, error: "No encontré lugares cerca en este momento." };
  }
}

export async function reverseLabelDirect(point: Point): Promise<Ok<{ label: string }>> {
  const key = `r:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
  const cached = fromCache<{ label: string }>(key, 30 * 60_000);
  if (cached) return { ok: true, data: cached };
  try {
    const out = { label: labelFromReverse(await getJson(nominatimReverseUrl(point))) };
    remember(key, out);
    return { ok: true, data: out };
  } catch {
    return { ok: true, data: { label: "Tu ubicación" } };
  }
}

export async function planRouteDirect(
  from: Point,
  to: Point,
  mode: TravelModeId,
): Promise<Ok<RoutePlan>> {
  if (!allowRequest()) return { ok: false, error: "Demasiadas rutas. Espera un momento." };
  const key = `p:${mode}:${from.lat.toFixed(4)},${from.lon.toFixed(4)}:${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
  const cached = fromCache<RoutePlan>(key, 10 * 60_000);
  if (cached) return { ok: true, data: cached };
  try {
    let plan: RoutePlan | null = null;
    for (const url of osrmUrls(from, to, mode)) {
      try {
        plan = routeFromOsrm(await getJson(url));
        if (plan) break;
      } catch {
        // try the next mirror
      }
    }
    if (!plan) return { ok: false, error: "No hay una ruta disponible entre esos puntos." };
    remember(key, plan);
    return { ok: true, data: plan };
  } catch {
    return { ok: false, error: "No pude trazar la ruta. Revisa la conexión e intenta de nuevo." };
  }
}
