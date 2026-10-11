/**
 * Pure helpers shared by the two transports that talk to the public map
 * services: `geo.functions.ts` (server functions, the default) and
 * `geo-direct.ts` (the phone calling Photon/Nominatim/Overpass/OSRM straight
 * from the browser when the server cannot reach them).
 *
 * Everything here is environment-agnostic: no fetch, no DOM. URLs are built
 * here so both transports hit exactly the same endpoints, and payloads are
 * parsed here so both return identical shapes. That keeps the two paths from
 * drifting apart, and makes the parsing testable without a network.
 */

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

export type Ok<T> = { ok: true; data: T } | { ok: false; error: string };

export type Point = { lat: number; lon: number };

export type TravelModeId = "foot" | "driving" | "bike";

export const CATEGORY: Record<string, string> = {
  restaurant: "Restaurante",
  cafe: "Café",
  fast_food: "Comida rápida",
  bar: "Bar",
  ice_cream: "Heladería",
  biergarten: "Cervecería",
  pub: "Pub",
  food_court: "Comedor",
};

export function categoryLabel(value?: string): string {
  if (!value) return "Lugar";
  return CATEGORY[value] ?? "Lugar";
}

export function addressFromPhoton(props: Record<string, string | undefined>): string {
  const street = [props.street, props.housenumber].filter(Boolean).join(" ");
  const area = props.locality || props.district || props.city || props.state || "";
  return [street, area].filter(Boolean).join(", ");
}

export function hitsFromPhoton(payload: unknown): GeoHit[] {
  const features =
    (payload as { features?: Array<Record<string, unknown>> } | null)?.features ?? [];
  return features
    .slice(0, 8)
    .map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, string | number | undefined>;
      const raw = (feature.geometry as { coordinates?: unknown } | undefined)?.coordinates;
      // Without a geoJSON point (0, 0) would land the pin in the Atlantic, so
      // a feature that carries no usable coordinates is dropped below.
      const coords = Array.isArray(raw) ? (raw as unknown[]) : [];
      // Street-level results often arrive with no name of their own (an unnamed
      // square, a road segment); falling back to the street keeps the row from
      // reading "Lugar · Calle de Durango, Roma Norte", which names nothing.
      const name = String(props.name || props.street || props.city || props.district || "Lugar");
      const id = `osm-${props.osm_type ?? "x"}-${props.osm_id ?? name}`;
      return {
        id,
        name,
        address: addressFromPhoton(props as Record<string, string | undefined>),
        lon: Number(coords[0]),
        lat: Number(coords[1]),
        category: categoryLabel(String(props.osm_value ?? "")),
      };
    })
    .filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lon));
}

export function hitsFromNominatim(payload: unknown): GeoHit[] {
  const rows = Array.isArray(payload) ? (payload as Array<Record<string, string>>) : [];
  return rows
    .map((row) => ({
      id: `nom-${row.place_id}`,
      name: row.name || row.display_name?.split(",")[0] || "Lugar",
      address: row.display_name ?? "",
      lat: Number(row.lat),
      lon: Number(row.lon),
      category: categoryLabel(row.type),
    }))
    .filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lon));
}

export function hitsFromOverpass(payload: unknown, point: Point): GeoHit[] {
  const elements = (payload as { elements?: Array<Record<string, unknown>> })?.elements ?? [];
  const hits: GeoHit[] = [];
  for (const element of elements) {
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

/** Metres between two points, straight line. */
export function crow(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Nearest hits first. Results that fall outside `maxMeters` are dropped when at
 * least one hit is close enough, so a search from the middle of a city does not
 * mix in another continent; when everything is far away we keep the ranking.
 */
export function rankByDistance<T extends Point>(hits: T[], here: Point, maxMeters = 60_000): T[] {
  const ranked = [...hits].sort(
    (a, b) => crow(here.lat, here.lon, a.lat, a.lon) - crow(here.lat, here.lon, b.lat, b.lon),
  );
  const close = ranked.filter((hit) => crow(here.lat, here.lon, hit.lat, hit.lon) < maxMeters);
  return close.length > 0 ? close : ranked.slice(0, 5);
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

export function stepText(type: string, modifier: string | undefined, name: string): string {
  const mod = modifier ? (MODIFIER[modifier] ?? modifier) : "";
  const street = name ? ` por ${name}` : "";
  if (type === "depart") return `Empieza${street || " la ruta"}`;
  if (type === "arrive") return "Llegaste al destino";
  if (type === "roundabout" || type === "rotary") return `Toma la glorieta${street}`;
  if (type === "turn" || type === "end of road")
    return `Gira ${mod}${street}`.replace(/\s+/g, " ").trim();
  if (type === "merge") return `Incorpórate ${mod}${street}`.replace(/\s+/g, " ").trim();
  if (type === "fork") return `En la bifurcación sigue ${mod}${street}`.replace(/\s+/g, " ").trim();
  return `Sigue ${mod}${street}`.replace(/\s+/g, " ").trim();
}

export function photonSearchUrl(q: string, near?: Point): string {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "default");
  if (near) {
    url.searchParams.set("lat", String(near.lat));
    url.searchParams.set("lon", String(near.lon));
  }
  return url.toString();
}

export function nominatimSearchUrl(q: string): string {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  return url.toString();
}

export function nominatimReverseUrl(point: Point): string {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(point.lat));
  url.searchParams.set("lon", String(point.lon));
  url.searchParams.set("zoom", "16");
  return url.toString();
}

/** Street-level label for the device fix, e.g. "Roma Norte". */
export function labelFromReverse(payload: unknown): string {
  const row = (payload ?? {}) as { address?: Record<string, string> };
  const address = row.address ?? {};
  return (
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.city ||
    address.town ||
    "Tu ubicación"
  );
}

export function overpassQuery(point: Point, radius = 1200): string {
  return `[out:json][timeout:16];(node["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream)$"](around:${radius},${point.lat},${point.lon});way["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream)$"](around:${radius},${point.lat},${point.lon}););out center 30;`;
}

export const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export const OSRM_PROFILES: Record<TravelModeId, string> = {
  foot: "foot",
  driving: "driving",
  bike: "bike",
};

/** Demo server first, then the community routing mirrors. */
export function osrmUrls(from: Point, to: Point, mode: TravelModeId): string[] {
  const path = `${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const profile = OSRM_PROFILES[mode];
  const mirror = mode === "driving" ? "routed-car" : mode === "bike" ? "routed-bike" : "routed-foot";
  return [
    `https://router.project-osrm.org/route/v1/${profile}/${path}`,
    `https://routing.openstreetmap.de/${mirror}/route/v1/${profile}/${path}`,
  ];
}

type RoutePayload = {
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
};

/** OSRM payload → route plan, or null when there is no route to draw. */
export function routeFromOsrm(payload: unknown): RoutePlan | null {
  const res = payload as RoutePayload;
  if (res?.code !== "Ok" || !res.routes?.[0]) return null;
  const route = res.routes[0];
  const steps = (route.legs ?? [])
    .flatMap((leg) => leg.steps ?? [])
    .map((step) => ({
      text: stepText(step.maneuver?.type ?? "continue", step.maneuver?.modifier, step.name ?? ""),
      distanceM: step.distance,
    }))
    .filter((step) => step.text.length > 0)
    .slice(0, 24);
  return {
    distanceM: route.distance,
    durationS: route.duration,
    geometry: (route.geometry?.coordinates ?? []).map(([x, y]) => [y, x]),
    steps,
  };
}
