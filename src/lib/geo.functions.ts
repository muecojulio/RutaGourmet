import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const UA = "RutaGourmet/1.0 (personal gourmet routes; +https://github.com/muecojulio/RutaGourmet)";

const HOSTS = new Set([
  "photon.komoot.io",
  "nominatim.openstreetmap.org",
  "router.project-osrm.org",
  "routing.openstreetmap.de",
  "overpass.openstreetmap.fr",
  "overpass.kumi.systems",
  "overpass-api.de",
]);

const lat = z.number().finite().gte(-90).lte(90);
const lon = z.number().finite().gte(-180).lte(180);

export type GeoHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string;
};

export type RouteStep = { text: string; distanceM: number };

export type RoutePlan = {
  distanceM: number;
  durationS: number;
  geometry: Array<[number, number]>;
  steps: RouteStep[];
};

type Ok<T> = { ok: true; data: T } | { ok: false; error: string };

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

const CATEGORY: Record<string, string> = {
  restaurant: "Restaurante",
  cafe: "Café",
  fast_food: "Comida rápida",
  bar: "Bar",
  ice_cream: "Heladería",
  biergarten: "Cervecería",
  pub: "Pub",
  food_court: "Comedor",
};

function categoryLabel(value?: string) {
  if (!value) return "Lugar";
  return CATEGORY[value] ?? "Lugar";
}

function addressFromPhoton(props: Record<string, string | undefined>) {
  const street = [props.street, props.housenumber].filter(Boolean).join(" ");
  const area = props.locality || props.district || props.city || props.state || "";
  return [street, area].filter(Boolean).join(", ");
}

function hitsFromPhoton(payload: unknown): GeoHit[] {
  const features = (payload as { features?: Array<Record<string, unknown>> }).features ?? [];
  return features.slice(0, 8).map((feature) => {
    const props = (feature.properties ?? {}) as Record<string, string | number | undefined>;
    const coords = ((feature.geometry as { coordinates?: number[] })?.coordinates ?? [0, 0]) as number[];
    const name = String(props.name || props.street || "Lugar");
    const id = `osm-${props.osm_type ?? "x"}-${props.osm_id ?? name}`;
    return {
      id,
      name,
      address: addressFromPhoton(props as Record<string, string | undefined>),
      lon: Number(coords[0]),
      lat: Number(coords[1]),
      category: categoryLabel(String(props.osm_value ?? "")),
    };
  }).filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lon));
}

function crow(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const MODIFIER: Record<string, string> = {
  left: "a la izquierda",
  right: "a la derecha",
  "slight left": "ligeramente a la izquierda",
  "slight right": "ligeramente a la derecha",
  "sharp left": "cerrado a la izquierda",
  "sharp right": "cerrado a la derecha",
  straight: "recto",
  uturn: "en U",
};

function stepText(type: string, modifier: string | undefined, name: string) {
  const mod = modifier ? (MODIFIER[modifier] ?? modifier) : "";
  const street = name ? ` por ${name}` : "";
  if (type === "depart") return `Empieza${street || " la ruta"}`;
  if (type === "arrive") return "Llegaste al destino";
  if (type === "roundabout" || type === "rotary") return `Toma la glorieta${street}`;
  if (type === "turn" || type === "end of road") return `Gira ${mod}${street}`.replace(/\s+/g, " ").trim();
  if (type === "merge") return `Incorpórate ${mod}${street}`.replace(/\s+/g, " ").trim();
  if (type === "fork") return `En la bifurcación sigue ${mod}${street}`.replace(/\s+/g, " ").trim();
  return `Sigue ${mod}${street}`.replace(/\s+/g, " ").trim();
}

async function searchPhoton(q: string, near?: { lat: number; lon: number }) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "default");
  if (near) {
    url.searchParams.set("lat", String(near.lat));
    url.searchParams.set("lon", String(near.lon));
  }
  return hitsFromPhoton(await fetchJson(url.toString()));
}

async function searchNominatim(q: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  const rows = (await fetchJson(url.toString())) as Array<Record<string, string>>;
  return rows.map((row) => ({
    id: `nom-${row.place_id}`,
    name: row.name || row.display_name.split(",")[0] || "Lugar",
    address: row.display_name,
    lat: Number(row.lat),
    lon: Number(row.lon),
    category: categoryLabel(row.type),
  }));
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
  const query = `[out:json][timeout:16];(node["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream)$"](around:1200,${point.lat},${point.lon});way["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream)$"](around:1200,${point.lat},${point.lon}););out center 30;`;
  const mirrors = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];
  let payload: { elements?: Array<Record<string, unknown>> } | null = null;
  for (const mirror of mirrors) {
    try {
      payload = (await postForm(mirror, `data=${encodeURIComponent(query)}`)) as {
        elements?: Array<Record<string, unknown>>;
      };
      if (payload?.elements) break;
    } catch {
      payload = null;
    }
  }
  if (!payload?.elements) return [];
  const hits: GeoHit[] = [];
  for (const element of payload.elements) {
    const tags = (element.tags ?? {}) as Record<string, string>;
    if (!tags.name) continue;
    const center = (element.center ?? null) as { lat?: number; lon?: number } | null;
    const y = typeof element.lat === "number" ? element.lat : center?.lat;
    const x = typeof element.lon === "number" ? element.lon : center?.lon;
    if (y == null || x == null) continue;
    const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
    hits.push({
      id: `osm-${element.type}-${element.id}`,
      name: tags.name,
      address: [street, tags["addr:suburb"] || tags["addr:city"] || ""].filter(Boolean).join(", "),
      lat: y,
      lon: x,
      category: categoryLabel(tags.amenity),
    });
  }
  hits.sort((a, b) => crow(point.lat, point.lon, a.lat, a.lon) - crow(point.lat, point.lon, b.lat, b.lon));
  return hits.slice(0, 16);
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
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(data.lat));
      url.searchParams.set("lon", String(data.lon));
      url.searchParams.set("zoom", "16");
      const row = (await fetchJson(url.toString())) as { address?: Record<string, string>; display_name?: string };
      const address = row.address ?? {};
      const label =
        address.suburb ||
        address.neighbourhood ||
        address.quarter ||
        address.city_district ||
        address.city ||
        address.town ||
        "Tu ubicación";
      const dataOut = { label };
      remember(key, dataOut);
      return { ok: true, data: dataOut };
    } catch {
      return { ok: true, data: { label: "Tu ubicación" } };
    }
  });

const PROFILES = { foot: "foot", driving: "driving", bike: "bike" } as const;

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
      const profile = PROFILES[data.mode];
      const path = `${data.fromLon},${data.fromLat};${data.toLon},${data.toLat}?overview=full&geometries=geojson&steps=true`;
      const urls = [
        `https://router.project-osrm.org/route/v1/${profile}/${path}`,
        data.mode === "driving"
          ? `https://routing.openstreetmap.de/routed-car/route/v1/driving/${path}`
          : data.mode === "bike"
            ? `https://routing.openstreetmap.de/routed-bike/route/v1/bike/${path}`
            : `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${path}`,
      ];
      let payload: {
        code?: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry?: { coordinates?: Array<[number, number]> };
          legs?: Array<{
            steps?: Array<{
              distance: number;
              name?: string;
              maneuver?: { type?: string; modifier?: string };
            }>;
          }>;
        }>;
      } | null = null;
      for (const url of urls) {
        try {
          payload = (await fetchJson(url)) as NonNullable<typeof payload>;
          if (payload?.code === "Ok" && payload.routes?.[0]) break;
          payload = null;
        } catch {
          payload = null;
        }
      }
      const route = payload?.routes?.[0];
      if (!route) {
        return { ok: false, error: "No hay una ruta disponible entre esos puntos." };
      }
      const steps = (route.legs ?? [])
        .flatMap((leg) => leg.steps ?? [])
        .map((step) => ({
          text: stepText(step.maneuver?.type ?? "continue", step.maneuver?.modifier, step.name ?? ""),
          distanceM: step.distance,
        }))
        .filter((step) => step.text.length > 0)
        .slice(0, 24);
      const plan: RoutePlan = {
        distanceM: route.distance,
        durationS: route.duration,
        geometry: (route.geometry?.coordinates ?? []).map(([x, y]) => [y, x]),
        steps,
      };
      remember(key, plan);
      setResponseHeader("Cache-Control", "private, max-age=120");
      return { ok: true, data: plan };
    } catch {
      return { ok: false, error: "No pude trazar la ruta. Revisa la conexión e intenta de nuevo." };
    }
  });
