import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchJsonAllowed, postFormAllowed } from "./fetch-allowlist.server";
import { TtlCache } from "./server-cache";
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

const lat = z.number().finite().gte(-90).lte(90);
const lon = z.number().finite().gte(-180).lte(180);

/**
 * Shared in-process cache for every public call. Fresh TTLs are short (the
 * world changes); stale windows are long, so a burst of repeat questions is
 * answered instantly while ONE background refresh keeps the value warm
 * (stale-while-revalidate, see server-cache.ts).
 */
const cache = new TtlCache(120);

let windowStart = Date.now();
let windowCount = 0;

/** Fixed-window rate limit per process — keeps the free/public services happy. */
function allowRequest(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= 48;
}

async function searchPhoton(q: string, near?: { lat: number; lon: number }) {
  return hitsFromPhoton(await fetchJsonAllowed(photonSearchUrl(q, near)));
}

async function searchNominatim(q: string) {
  return hitsFromNominatim(await fetchJsonAllowed(nominatimSearchUrl(q)));
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
    const near =
      data.lat != null && data.lon != null ? { lat: data.lat, lon: data.lon } : undefined;
    const key = `s:${data.q.toLowerCase()}:${near ? `${near.lat.toFixed(3)},${near.lon.toFixed(3)}` : "-"}`;
    try {
      const hits = await cache.resolve({
        key,
        ttlMs: 3 * 60_000,
        staleMs: 30 * 60_000,
        load: async () => {
          let found = await searchPhoton(data.q, near);
          if (found.length === 0) found = await searchNominatim(data.q);
          return found;
        },
      });
      setResponseHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
      return { ok: true, data: hits };
    } catch {
      return { ok: false, error: "No se pudo buscar ahora. Intenta de nuevo en unos segundos." };
    }
  });

async function nearbyOverpass(point: { lat: number; lon: number }): Promise<GeoHit[]> {
  const body = `data=${encodeURIComponent(overpassQuery(point))}`;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const payload = await postFormAllowed(mirror, body);
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
    try {
      const hits = await cache.resolve({
        key,
        ttlMs: 5 * 60_000,
        staleMs: 60 * 60_000,
        load: async () => {
          const found = await nearbyOverpass(data);
          if (found.length > 0) return found;
          const photon = await searchPhoton("restaurante", data);
          return photon
            .filter((hit) => crow(data.lat, data.lon, hit.lat, hit.lon) < 4000)
            .slice(0, 12);
        },
      });
      setResponseHeader("Cache-Control", "private, max-age=120, stale-while-revalidate=600");
      return { ok: true, data: hits };
    } catch {
      return { ok: false, error: "No encontré lugares cerca en este momento." };
    }
  });

export const reverseLabel = createServerFn({ method: "GET" })
  .validator(z.object({ lat, lon }))
  .handler(async ({ data }): Promise<Ok<{ label: string }>> => {
    const key = `r:${data.lat.toFixed(3)},${data.lon.toFixed(3)}`;
    try {
      const out = await cache.resolve({
        key,
        ttlMs: 30 * 60_000,
        staleMs: 24 * 60 * 60_000,
        load: async () => {
          const payload = await fetchJsonAllowed(nominatimReverseUrl(data));
          return { label: labelFromReverse(payload) };
        },
      });
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
    try {
      const plan = await cache.resolve({
        key,
        ttlMs: 10 * 60_000,
        staleMs: 2 * 60 * 60_000,
        load: async () => {
          const mode = data.mode as TravelModeId;
          const urls = osrmUrls(
            { lat: data.fromLat, lon: data.fromLon },
            { lat: data.toLat, lon: data.toLon },
            mode,
          );
          let payload: unknown = null;
          for (const url of urls) {
            try {
              const res = await fetchJsonAllowed(url);
              if (routeFromOsrm(res)) {
                payload = res;
                break;
              }
            } catch {
              // try the next mirror
            }
          }
          const loaded = routeFromOsrm(payload);
          if (!loaded) throw new Error("sin-ruta");
          return loaded;
        },
      });
      setResponseHeader("Cache-Control", "private, max-age=120, stale-while-revalidate=600");
      return { ok: true, data: plan };
    } catch (err) {
      if (err instanceof Error && err.message === "sin-ruta") {
        return { ok: false, error: "No hay una ruta disponible entre esos puntos." };
      }
      return { ok: false, error: "No pude trazar la ruta. Revisa la conexión e intenta de nuevo." };
    }
  });
