# RutaGourmet

App instalable para guardar restaurantes y lugares, marcar favoritos y ver cómo llegar.

- **Mapa con buscador**: escribe el restaurante al que quieres ir y guárdalo con un toque.
- **Botón _Agregar lugar_**: abre una hoja con el buscador y «Cerca» para ver qué hay alrededor.
- **Punto de partida**: botón sobre el mapa. Toma tu ubicación (geolocalización) o busca una
  dirección; de ahí salen todas las rutas.
- **Cómo llegar**: ruta a pie, en auto o en bici, con distancia, tiempo e indicaciones paso a paso.
- **Favoritos**: carrusel de «joyas», corazón con destello, y sugerencias de visitados pendientes.
- **Clima del momento**: chip sobre el mapa que dice si es buen momento para salir (Open-Meteo).
- **Historia y cultura cerca**: contexto de Wikipedia alrededor de cada lugar guardado.

Los lugares quedan en el teléfono. Las búsquedas y rutas usan servicios **públicos, sin llave y
sin registro**. Si el servidor de la app no alcanza esos servicios (por ejemplo en una red
restringida), el navegador los consulta directamente.

Node.js 24.x

---

## APIs públicas integradas (sin key, sin registro)

Seleccionadas del catálogo abierto [`public-apis/public-apis`](https://github.com/public-apis/public-apis)
(MIT) y de la comunidad de OpenStreetMap:

| Servicio                    | Uso                                        | Límite/clave            |
| --------------------------- | ------------------------------------------ | ----------------------- |
| Photon (Komoot)             | Búsqueda de lugares                        | ninguno                 |
| Nominatim (OSM)             | Geocodificación y nombre de tu ubicación   | política de uso pública |
| Overpass (OSM)              | Restaurantes/cercanos                      | espejos comunitarios    |
| OSRM (demo + espejos)       | Rutas a pie, bici, auto                    | demo pública            |
| CARTO                       | Teselas del mapa base                      | gratis con atribución   |
| **Open-Meteo**              | Clima del momento y consejo «¿salimos?»    | ninguno                 |
| **Wikipedia** (geobúsqueda) | Historia y cultura alrededor de cada lugar | ninguno                 |

Toda la salida del servidor está protegida por una **lista de permitidos de hosts** (anti‑SSRF,
`src/lib/fetch-allowlist.server.ts`), con validación Zod de entradas, límite de tasa por proceso y
caché compartida.

## Sistema de interacciones (`src/components/ui/`)

Biblioteca propia inspirada en las recetas de [Radix UI](https://github.com/radix-ui/primitives) y
[shadcn/ui](https://github.com/shadcn-ui/ui) (ambas MIT), con utilidades adaptadas de
[`usehooks-ts`](https://github.com/juliencrn/usehooks-ts) y [`usehooks`](https://github.com/uidotdev/usehooks)
(MIT; ver encabezados de `src/lib/hooks.ts`):

- **`ui/button.tsx`** — botón único con variantes, objetivos táctiles ≥ 44 px, `touch-action:
manipulation`, hundimiento al presionar (`.press`) y estados **cargando** (`aria-busy`, bloquea
  reenvíos), **éxito** (check) y **error** (sacudida discreta + `aria-invalid`).
- **`ui/tabs.tsx` + `ui/use-panel-swipe.ts`** — pestañas WAI-ARIA con píldora animada, foco errante
  (flechas, Inicio/Fin), carril con desplazamiento nativo que centra la pestaña activa con bordes
  difuminados, paneles con fundido (180–250 ms) y **swipe horizontal entre secciones** con bloqueo
  de eje (~1,2×, `src/lib/gestures.ts`), excluyendo botones/campos/mapa.
- **`ui/chip-lane.tsx`** — carriles de chips/filtros con scroll nativo, snap moderado, scrollbar solo
  visual, indicadores de desbordamiento que aparecen solo cuando hay contenido fuera de vista, y
  protección anti-activación tras un arrastre.
- **`ui/carousel.tsx`** — carrusel con `scroll-snap`, tarjeta siguiente asomando, dots accesibles y
  botones ←/→; en pantallas grandes se convierte en cuadrícula.
- **`ui/swipe-card.tsx`** — desliza una tarjeta para revelar acciones (ancho limitado, umbral +
  flick, click-post-arrastre suprimido, acciones `inert` cuando están ocultas). Nunca es el único
  camino: botón «···» visible y acciones en línea en escritorio.
- **`ui/combobox.tsx`** — combobox con búsqueda que ignora mayúsculas y diacríticos
  (`src/lib/text.ts`), semántica completa (flechas, Inicio/Fin, Enter, Escape, clic fuera),
  opción activa siempre visible y anuncios `aria-live`.
- **`ui/segmented.tsx`**, **`ui/collapse.tsx`**, **`ui/field.tsx`**, **`ui/input.ts`** — control
  segmentado con pulgar animado, acordeones animados (0fr→1fr) con `aria-expanded`/`inert`,
  campos etiquetados con halo de foco y switches `role="switch"` + `aria-checked`.

Todo respeta `prefers-reduced-motion` (desactiva animaciones decorativas y el scroll suave) y no
bloquea zoom, scroll ni gestos del navegador.

## Base de datos

Esquema único en `migrations/` aplicado a Neon (deploy) y a la PGLite local (preview) por
`scripts/migrate.mjs` / `src/lib/db.ts`.

- `migrations/auth/0001_auth.sql` — esquema de Better Auth (solo cuando el inicio de sesión está
  activo). Ya incluye índices en las columnas de unión (`userId`, `identifier`).
- `migrations/0002_indexes.sql` — **índices de rendimiento** añadidos tras auditar las rutas de
  consulta: `session("expiresAt")` y `verification("expiresAt")` (las purgas de sesiones/verificaciones
  vencidas de Better Auth hoy hacen un scan completo en Neon). Los índices sobre columnas ya
  cubiertas se descartaron por coste de escritura innecesario. Protegido con guardas `to_regclass`
  para que también funcione en el preview PGLite sin tablas de auth.

## Caché

- **Servidor**: `src/lib/server-cache.ts` — LRU con TTL + **stale-while-revalidate** con
  _single-flight_ (una respuesta caducada se sirve al instante mientras UN refresco corre en segundo
  plano). La usan geo, clima y Wikipedia. Cabeceras HTTP `Cache-Control` con
  `stale-while-revalidate` en cada server function.
- **Cliente**: `src/lib/geo-direct.ts` / `conditions-direct.ts` mantienen su propia caché para el
  transporte directo del navegador.
- Los activos estáticos los sirve la plataforma con hash inmutable (Vite).

## Seguridad

- `npm audit` limpio (0 vulnerabilidades) con las dependencias al día.
- Cabeceras en producción (`server/middleware/security-headers.ts`): `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` restrictiva y HSTS bajo HTTPS. Sin `X-Frame-Options` ni
  CSP de `frame-ancestors` porque la plataforma de preview embebe la app legítimamente en un iframe.
- Anti-SSRF: solo hosts de la lista de permitidos; timeouts en todas las salidas.
- Aislamiento Fetch-Metadata (`src/lib/auth/isolation.server.ts`) y middleware de auth con
  `assertSameSiteRequest` para peticiones entre apps hermanas.
- Validación de entradas de server functions con Zod (coords acotadas, textos ≤ 80/280).
- Ver `SECURITY.md` para reportar vulnerabilidades.

## Código muerto eliminado

- `src/lib/multiplayer/` (P2P sin usar, ~570 líneas).
- 31 dependencias sin uso (Radix no usados, formularios, tablas, gráficas, calendarios, `cmdk`,
  `vaul`, `date-fns`, `recharts`, `lightningcss`, `tw-animate-css`, …) — menos superficie de
  ataque y de mantenimiento.

## Privacidad

- Resumen amable en la pestaña **Privacidad** de la app; texto completo en **`/privacidad`**
  (responsable, finalidad, base jurídica RGPD/LFPDPPP, conservación, derechos, menores, seguridad).

## Desarrollo

```bash
npm run dev        # http://localhost:8080
npm run build      # build + migraciones (si hay DATABASE_URL)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # node --test (unitarias puras)
```
