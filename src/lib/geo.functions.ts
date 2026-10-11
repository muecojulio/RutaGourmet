import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
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
  type RoutePlan,
  type TravelModeId,
} from "./geo-core";

export type { GeoHit, Ok, RoutePlan, RouteStep } from "./geo-core";

const UA = "RutaGourmet/1.0 (personal gourmet routes; +https://github.com/muecojulio/RutaGourmet)";

/** Only these hosts may be reached from a server function. */
const HOSTS = new Set([
  "photon.komoot.io",
  "nominatim.openstreetmap.org",
  "router.project-osrm.org",
  "routing.openstreetmap.de",
  ...OVERPASS_MIRRORS.map((mirror) => new URL(mirror).host),
]);

const lat = z.number().finite().gte(-90).lte(90);
const lon = z.number().finite().gte(-180).lte(180);

const cache = new Map<string, { at: number; data: unknown }>();
let windowStart = Date.now();
let windowCount = 0;

function allowRequest(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= 48;
}

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
  if (cache.size > 80) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

async function fetchJson(url: string): Promise<unknown> {
  const host = new URL(url).host;
  if (!HOSTS.has(host)) throw new Error("Destino no permitido");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(14_000),
  });
  if (!response.ok) throw new Error(`El servicio de mapas respondió ${response.status}`);
  return response.json();
}

async function postForm(url: string, body: string): Promise<unknown> {
  const host = new URL(url).host;
  if (!HOSTS.has(host)) throw new Error("Destino no permitido");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": UA,
    },
    body,
    signal: AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error(`El servicio de mapas respondió ${response.status}`);
  return response.json();
}

async function searchPhoton(q: string, near?: { lat: number; lon: number }) {
  return hitsFromPhoton(await fetchJson(photonSearchUrl(q, near)));
}

async function searchNominatim(q: string) {
  return hitsFromNominatim(await fetchJson(nominatimSearchUrl(q)));
}

export const searchPlaces = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().trim().min(2).max(80),
      lat: lat.optional(),
      lon: lon.optional(),
    }),
  )
  .handler(async ({ data }): Promise<Ok<GeoHit[]>> => {
    if (!allowRequest()) return { ok: false, error: "Demasiadas búsquedas. Espera un momento." };
    const near = data.lat != null && data.lon != null ? { lat: data.lat, lon: data.lon } : undefined;
    const key = `s:${data.q.toLowerCase()}:${near ? `${near.lat.toFixed(3)},${near.lon.toFixed(3)}` : "-"}`;
    const cached = fromCache<GeoHit[]>(key, 3 * 60_000);
    if (cached) return { ok: true, data: cached };
    try {
      let hits = await searchPhoton(data.q, near);
      if (hits.length === 0) hits = await searchNominatim(data.q);
      remember(key, hits);
      setResponseHeader("Cache-Control", "private, max-age=60");
      return { ok: true, data: hits };
    } catch {
      return { ok: false, error: "No se pudo buscar ahora. Intenta de nuevo en unos segundos." };
    }
  });

async function nearbyOverpass(point: { lat: number; lon: number }): Promise<GeoHit[]> {
  const body = `data=${encodeURIComponent(overpassQuery(point))}`;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const payload = await postForm(mirror, body);
      const hits = hitsFromOverpass(payload, point);
      if (hits.length > 0) return hits;
    } catch {
      // try the next mirror
    }
  }
  return [];
}

export const nearbyPlaces = createServerFn({ method: "GET" })
  .validator(z.object({ lat, lon }))
  .handler(async ({ data }): Promise<Ok<GeoHit[]>> => {
    if (!allowRequest()) return { ok: false, error: "Demasiadas búsquedas. Espera un momento." };
    const key = `n:${data.lat.toFixed(3)},${data.lon.toFixed(3)}`;
    const cached = fromCache<GeoHit[]>(key, 5 * 60_000);
    if (cached) return { ok: true, data: cached };
    try {
      let hits = await nearbyOverpass(data);
      if (hits.length === 0) {
        const photon = await searchPhoton("restaurante", data);
        hits = photon
          .filter((hit) => crow(data.lat, data.lon, hit.lat, hit.lon) < 4000)
          .slice(0, 12);
      }
      remember(key, hits);
      setResponseHeader("Cache-Control", "private, max-age=120");
      return { ok: true, data: hits };
    } catch {
      return { ok: false, error: "No encontré lugares cerca en este momento." };
    }
  });

export const reverseLabel = createServerFn({ method: "GET" })
  .validator(z.object({ lat, lon }))
  .handler(async ({ data }): Promise<Ok<{ label: string }>> => {
    const key = `r:${data.lat.toFixed(3)},${data.lon.toFixed(3)}`;
    const cached = fromCache<{ label: string }>(key, 30 * 60_000);
    if (cached) return { ok: true, data: cached };
    try {
      const payload = await fetchJson(nominatimReverseUrl(data));
      const out = { label: labelFromReverse(payload) };
      remember(key, out);
      return { ok: true, data: out };
    } catch {
      // Not an answer, just a failure to name the spot: the caller falls back to
      // the browser transport, which labels it "Tu ubicación" if that fails too.
      return { ok: false, error: "No pude nombrar la ubicación." };
    }
  });

export const planRoute = createServerFn({ method: "GET" })
  .validator(
    z.object({
      fromLat: lat,
      fromLon: lon,
      toLat: lat,
      toLon: lon,
      mode: z.enum(["foot", "driving", "bike"]),
    }),
  )
  .handler(async ({ data }): Promise<Ok<RoutePlan>> => {
    if (!allowRequest()) return { ok: false, error: "Demasiadas rutas. Espera un momento." };
    const key = `p:${data.mode}:${data.fromLat.toFixed(4)},${data.fromLon.toFixed(4)}:${data.toLat.toFixed(4)},${data.toLon.toFixed(4)}`;
    const cached = fromCache<RoutePlan>(key, 10 * 60_000);
    if (cached) return { ok: true, data: cached };
    try {
      const mode = data.mode as TravelModeId;
      const urls = osrmUrls(
        { lat: data.fromLat, lon: data.fromLon },
        { lat: data.toLat, lon: data.toLon },
        mode,
      );
      let payload: unknown = null;
      for (const url of urls) {
        try {
          const res = await fetchJson(url);
          if (routeFromOsrm(res)) {
            payload = res;
            break;
          }
        } catch {
          // try the next mirror
        }
      }
      const plan = routeFromOsrm(payload);
      if (!plan) return { ok: false, error: "No hay una ruta disponible entre esos puntos." };
      remember(key, plan);
      setResponseHeader("Cache-Control", "private, max-age=120");
      return { ok: true, data: plan };
    } catch {
      return { ok: false, error: "No pude trazar la ruta. Revisa la conexión e intenta de nuevo." };
    }
  });
