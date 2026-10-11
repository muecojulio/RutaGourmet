/**
 * The one door the app uses for places, routes and coordinates.
 *
 * Every call goes first to the server function — shared cache, shared rate
 * limit, and the public endpoints stay off the phone's request log. Only when
 * the server cannot answer *because it could not reach the outside world* does
 * the browser retry the exact same public service directly (`geo-direct.ts`),
 * so a preview or a local sandbox with blocked egress still searches and routes
 * instead of looking broken. A server answer that is a real "no results" reply
 * is returned as-is and never retried.
 */
import {
  nearbyPlaces as nearbyOnServer,
  planRoute as planOnServer,
  reverseLabel as reverseOnServer,
  searchPlaces as searchOnServer,
} from "@/lib/geo.functions";
import {
  nearbyPlacesDirect,
  planRouteDirect,
  reverseLabelDirect,
  searchPlacesDirect,
} from "@/lib/geo-direct";
import type { GeoHit, Ok, Point, RoutePlan, TravelModeId } from "@/lib/geo-core";

export type { GeoHit, Ok, Point, RoutePlan, RouteStep, TravelModeId } from "@/lib/geo-core";
export { crow, rankByDistance } from "@/lib/geo-core";

async function serverOrPhone<T>(server: () => Promise<Ok<T>>, phone: () => Promise<Ok<T>>) {
  try {
    const result = await server();
    if (result && result.ok) return result;
  } catch {
    // Server function unreachable: the phone tries the public endpoints itself.
  }
  return phone();
}

export function searchPlaces(data: { q: string; lat?: number; lon?: number }): Promise<Ok<GeoHit[]>> {
  const near: Point | undefined =
    data.lat != null && data.lon != null ? { lat: data.lat, lon: data.lon } : undefined;
  return serverOrPhone(
    () => searchOnServer({ data: { q: data.q, ...(near ?? {}) } }),
    () => searchPlacesDirect(data.q, near),
  );
}

export function nearbyPlaces(point: Point): Promise<Ok<GeoHit[]>> {
  return serverOrPhone(
    () => nearbyOnServer({ data: point }),
    () => nearbyPlacesDirect(point),
  );
}

export function reverseLabel(point: Point): Promise<Ok<{ label: string }>> {
  return serverOrPhone(
    () => reverseOnServer({ data: point }),
    () => reverseLabelDirect(point),
  );
}

export function planRoute(data: {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  mode: TravelModeId;
}): Promise<Ok<RoutePlan>> {
  return serverOrPhone(
    () => planOnServer({ data }),
    () =>
      planRouteDirect(
        { lat: data.fromLat, lon: data.fromLon },
        { lat: data.toLat, lon: data.toLon },
        data.mode,
      ),
  );
}
