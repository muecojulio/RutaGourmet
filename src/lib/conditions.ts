/**
 * The one door the UI uses for weather and Wikipedia context — same shape as
 * `geo.ts`: server function first (shared cache, allow-listed egress), browser
 * fallback only when the server itself cannot reach the outside world.
 */
import { weatherNow as weatherOnServer, wikiContext as wikiOnServer } from "./conditions.functions";
import { weatherNowDirect, wikiContextDirect } from "./conditions-direct";
import type { Ok, Point, WeatherNow, WikiContext } from "./conditions-core";

export type { WeatherNow, WikiContext, WikiHit } from "./conditions-core";
export { weatherAdvice, weatherEmoji, weatherLabel } from "./conditions-core";

async function serverOrPhone<T>(
  server: () => Promise<Ok<T>>,
  phone: () => Promise<Ok<T>>,
): Promise<Ok<T>> {
  try {
    const result = await server();
    if (result && result.ok) return result;
  } catch {
    // Server function unreachable: the phone tries the public service itself.
  }
  return phone();
}

export function weatherNow(point: Point): Promise<Ok<WeatherNow>> {
  return serverOrPhone(
    () => weatherOnServer({ data: point }),
    () => weatherNowDirect(point),
  );
}

export function wikiContext(point: Point): Promise<Ok<WikiContext>> {
  return serverOrPhone(
    () => wikiOnServer({ data: point }),
    () => wikiContextDirect(point),
  );
}
