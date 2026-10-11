# Política de seguridad de RutaGourmet

## Reportar una vulnerabilidad

Abre un **issue privado** (o un security advisory) en el repositorio
`muecojulio/RutaGourmet`. No publiques exploits en issues públicos. Responderemos
y publicaremos correcciones tan pronto como sea razonable; este es un proyecto
personal sin equipo de guardia, así que usa también el sentido común antes de
confiarle datos sensibles (aunque la app, por diseño, casi no guarda ninguno).

## Superficie y controles

| Área                               | Control                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Salida de red del servidor         | Lista de permitidos de hosts (`src/lib/fetch-allowlist.server.ts`) — bloquea SSRF; timeouts en todas las llamadas          |
| Entradas de server functions       | Validación Zod estricta (coordenadas acotadas, cadenas ≤ 80/280)                                                           |
| Rate limit                         | Ventana fija por proceso para llamadas a servicios públicos                                                                |
| Caché                              | En memoria, sin datos personales, con expiración por TTL y capacidad                                                       |
| Sesiones (si el login está activo) | Better Auth + cookies `__Host-`, aislamiento Fetch-Metadata (`assertSameSiteRequest`)                                      |
| Cabeceras HTTP                     | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en HTTPS (`server/middleware/security-headers.ts`) |
| Dependencias                       | `npm audit` limpio; dependencias muertas eliminadas para reducir superficie                                                |
| Datos del usuario                  | Local-first: lugares/notas en `localStorage` del dispositivo, nunca en servidores propios                                  |

## Decisiones explícitas

- **No** se fuerza `X-Frame-Options`/`frame-ancestors`: la plataforma de preview
  embebe la app en un iframe cruzado por diseño. La isolation de peticiones
  cubre el riesgo de sesión entre apps hermanas.
- **No** se usa `cross-origin-opener-policy`: el flujo OAuth popup salta a un
  proveedor externo y volvería cortado con COOP.
- El navegador consulta servicios públicos **directamente** solo como
  respaldo (`geo-direct.ts`, `conditions-direct.ts`), siempre con
  `credentials: "omit"` y timeout.

## Buenas prácticas para contribuir

- Nunca registres claves ni tokens: este proyecto integra únicamente servicios
  públicos sin registro.
- Toda nueva llamada saliente debe pasar por la lista de permitidos.
- Toda nueva server function debe validar entradas con Zod y considerar rate
  limit + caché.
