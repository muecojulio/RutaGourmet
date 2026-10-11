/**
 * Security headers on every response (deployed Nitro + dev preview).
 *
 * Modeled on `grok-pwa.ts` (same auto-registration via `serverDir`). Only
 * headers that cannot break the supported embedding surfaces are set — the app
 * legitimately runs inside the platform's preview iframe, so `X-Frame-Options`
 * / `frame-ancestors` are deliberately NOT forced here.
 */
interface SecurityEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function securityHeaders(proto: string): Array<[string, string]> {
  const headers: Array<[string, string]> = [
    // Never let browsers sniff a content type — protects against uploaded/
    // reflected content being reinterpreted as HTML or JS.
    ["x-content-type-options", "nosniff"],
    // Referer leaks little anyway (same-site), but be explicit.
    ["referrer-policy", "strict-origin-when-cross-origin"],
    // The app needs geolocation (self); everything else it never uses.
    [
      "permissions-policy",
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
    ],
    // NOTE: no `cross-origin-opener-policy` — the OAuth popup flow legitimately
    // hops to the external identity provider and back, and COOP would sever
    // that window relationship. No `X-Frame-Options` either — the platform
    // preview embeds this app in a cross-origin iframe by design.
  ];
  if (proto === "https") {
    headers.push(["strict-transport-security", "max-age=31536000; includeSubDomains"]);
  }
  return headers;
}

export default async function securityHeadersMiddleware(
  event: SecurityEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();

  // Only touch response-shaped results (h3 may return raw strings/objects for
  // internal handlers — leave those alone).
  if (!(result instanceof Response)) return result;

  const proto = event.req.headers.get("x-forwarded-proto") ?? event.url.protocol.replace(":", "");
  const headers = new Headers(result.headers);
  for (const [name, value] of securityHeaders(proto)) headers.set(name, value);
  if (headers.has("x-powered-by")) headers.delete("x-powered-by");

  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}
