/**
 * Server-only egress guard: every outbound call a server function makes must
 * target one of the allow-listed public services. Anything else throws, so a
 * bad interpolation can never turn a fetch helper into an open proxy (SSRF).
 *
 * Lives in a `.server.ts` module so it can never be bundled into client code.
 */
export const UA =
  "RutaGourmet/1.1 (personal gourmet routes; +https://github.com/muecojulio/RutaGourmet)";

import { OVERPASS_MIRRORS } from "./geo-core";

/** The only hosts a server function may reach. */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "photon.komoot.io",
  "nominatim.openstreetmap.org",
  "router.project-osrm.org",
  "routing.openstreetmap.de",
  "api.open-meteo.com",
  "es.wikipedia.org",
  ...OVERPASS_MIRRORS.map((mirror) => new URL(mirror).host),
]);

function assertAllowed(url: string): void {
  const host = new URL(url).host;
  if (!ALLOWED_HOSTS.has(host)) throw new Error(`Destino no permitido: ${host}`);
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  assertAllowed(url);
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`El servicio público respondió ${response.status}`);
  return response.json();
}

/** GET a public API (allow-listed host only). */
export function fetchJsonAllowed(url: string, timeoutMs = 14_000): Promise<unknown> {
  return requestJson(url, { headers: { Accept: "application/json" } }, timeoutMs);
}

/** POST a form body to a public API (allow-listed host only). */
export function postFormAllowed(url: string, body: string, timeoutMs = 18_000): Promise<unknown> {
  return requestJson(
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    },
    timeoutMs,
  );
}
