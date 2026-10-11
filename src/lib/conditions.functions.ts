import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchJsonAllowed } from "./fetch-allowlist.server";
import { TtlCache } from "./server-cache";
import {
  openMeteoUrl,
  weatherFromOpenMeteo,
  wikiFromPayload,
  wikiGeosearchUrl,
  type Ok,
  type WeatherNow,
  type WikiContext,
} from "./conditions-core";

export type { WeatherNow, WikiContext } from "./conditions-core";

/**
 * Server functions for the keyless public "ambience" services: Open-Meteo
 * (weather at the start point) and Wikipedia geosearch (context around a
 * saved place). Same contract as `geo.functions.ts`: allow-listed egress,
 * shared cache with stale-while-revalidate, per-process rate limit.
 */
const cache = new TtlCache(80);

const lat = z.number().finite().gte(-90).lte(90);
const lon = z.number().finite().gte(-180).lte(180);

let windowStart = Date.now();
let windowCount = 0;

function allowRequest(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= 60;
}

export const weatherNow = createServerFn({ method: "GET" })
  .validator(z.object({ lat, lon }))
  .handler(async ({ data }): Promise<Ok<WeatherNow>> => {
    if (!allowRequest()) return { ok: false, error: "Demasiadas consultas. Espera un momento." };
    const key = `w:${data.lat.toFixed(2)},${data.lon.toFixed(2)}`;
    try {
      const weather = await cache.resolve({
        key,
        ttlMs: 15 * 60_000,
        staleMs: 2 * 60 * 60_000,
        load: async () => {
          const weather = weatherFromOpenMeteo(await fetchJsonAllowed(openMeteoUrl(data)));
          if (!weather) throw new Error("respuesta-meteorologica-invalida");
          return weather;
        },
      });
      setResponseHeader("Cache-Control", "private, max-age=600, stale-while-revalidate=1800");
      return { ok: true, data: weather };
    } catch {
      return { ok: false, error: "No pude consultar el clima ahora." };
    }
  });

export const wikiContext = createServerFn({ method: "GET" })
  .validator(z.object({ lat, lon }))
  .handler(async ({ data }): Promise<Ok<WikiContext>> => {
    if (!allowRequest()) return { ok: false, error: "Demasiadas consultas. Espera un momento." };
    const key = `k:${data.lat.toFixed(3)},${data.lon.toFixed(3)}`;
    try {
      const context = await cache.resolve({
        key,
        ttlMs: 24 * 60 * 60_000,
        staleMs: 7 * 24 * 60 * 60_000,
        load: async () => wikiFromPayload(await fetchJsonAllowed(wikiGeosearchUrl(data))),
      });
      setResponseHeader("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
      return { ok: true, data: context };
    } catch {
      return { ok: false, error: "Sin historias cerca por ahora." };
    }
  });
