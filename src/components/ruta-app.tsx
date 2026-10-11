import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  Bookmark,
  Car,
  ChevronDown,
  ChevronUp,
  Footprints,
  Heart,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Navigation,
  QrCode,
  Route as RouteIcon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Trash2,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { MapCanvas, type MapFocus } from "@/components/map-canvas";
import type { MapInsets } from "@/lib/map-fit";
import { QrDownloadPanel } from "@/components/qr-download-panel";
import { PrivacyPanel } from "@/components/privacy-panel";
import { crowFlies, formatDistance, formatDuration } from "@/lib/format";
import {
  nearbyPlaces,
  planRoute,
  reverseLabel,
  searchPlaces,
  type GeoHit,
  type RoutePlan,
} from "@/lib/geo.functions";
import {
  activePlace,
  usePlaces,
  type AppTab,
  type Place,
  type TravelMode,
} from "@/lib/places-store";
import * as Switch from "@radix-ui/react-switch";

const MODES: Array<{ id: TravelMode; label: string; icon: typeof Footprints }> = [
  { id: "foot", label: "A pie", icon: Footprints },
  { id: "driving", label: "Auto", icon: Car },
  { id: "bike", label: "Bici", icon: Bike },
];

const TABS = [
  { id: "mapa", label: "Mapa", shortLabel: "Mapa", icon: MapIcon },
  { id: "lugares", label: "Lugares", shortLabel: "Lugares", icon: Bookmark },
  { id: "favoritos", label: "Favoritos", shortLabel: "Favoritos", icon: Heart },
  { id: "qr", label: "Descargar QR", shortLabel: "QR App", icon: QrCode },
  { id: "privacidad", label: "Privacidad", shortLabel: "Privacidad", icon: ShieldCheck },
  { id: "ajustes", label: "Ajustes", shortLabel: "Ajustes", icon: Settings },
] as const;

const FALLBACK_ORIGIN = {
  lat: 19.4194,
  lon: -99.1617,
  label: "Roma Norte",
  isDevice: false,
};

export function RutaApp() {
  const places = usePlaces((s) => s.places);
  const origin = usePlaces((s) => s.origin);
  const activeId = usePlaces((s) => s.activeId);
  const mode = usePlaces((s) => s.mode);
  const theme = usePlaces((s) => s.theme);
  const tab = usePlaces((s) => s.tab);
  const setTab = usePlaces((s) => s.setTab);
  const setMode = usePlaces((s) => s.setMode);
  const setTheme = usePlaces((s) => s.setTheme);
  const setOrigin = usePlaces((s) => s.setOrigin);
  const setActive = usePlaces((s) => s.setActive);
  const savePlace = usePlaces((s) => s.savePlace);
  const toggleFavorite = usePlaces((s) => s.toggleFavorite);
  const toggleVisited = usePlaces((s) => s.toggleVisited);
  const setNote = usePlaces((s) => s.setNote);
  const removePlace = usePlaces((s) => s.removePlace);

  const [hydrated, setHydrated] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [cardCompact, setCardCompact] = useState(false);
  const [mapInsets, setMapInsets] = useState<MapInsets>({ top: 0, bottom: 0 });
  const [mapFocus, setMapFocus] = useState<MapFocus>("route");
  const [focusSeq, setFocusSeq] = useState(0);

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapTopRef = useRef<HTMLDivElement | null>(null);
  const mapBottomRef = useRef<HTMLDivElement | null>(null);

  const place = activePlace(places, activeId);
  const placeId = place?.id ?? null;

  const requestFocus = useCallback((target: MapFocus) => {
    setMapFocus(target);
    setFocusSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    const unsub = usePlaces.persist.onFinishHydration(() => {
      if (live) setHydrated(true);
    });
    void Promise.resolve(usePlaces.persist.rehydrate()).then(() => {
      if (live) setHydrated(true);
    });
    return () => {
      live = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
    if (meta && bg) meta.setAttribute("content", bg);
  }, [theme]);

  // How much of the map the floating panels cover. Re-synced after every render
  // (panels mount, unmount and change height as the user types, searches or
  // opens a card), so the route fit below never hides under them.
  useEffect(() => {
    const box = mapWrapRef.current;
    if (!box) return;
    const measure = () => {
      const base = box.getBoundingClientRect();
      if (base.height < 1) return; // hidden on this tab: keep the last good numbers
      const topEdge = mapTopRef.current?.getBoundingClientRect().bottom;
      const bottomEdge = mapBottomRef.current?.getBoundingClientRect().top;
      const next: MapInsets = {
        top: topEdge == null ? 0 : Math.max(0, Math.round(topEdge - base.top)),
        bottom: bottomEdge == null ? 0 : Math.max(0, Math.round(base.bottom - bottomEdge)),
      };
      setMapInsets((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (mapTopRef.current) observer.observe(mapTopRef.current);
    if (mapBottomRef.current) observer.observe(mapBottomRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  // A card always opens with its details showing.
  useEffect(() => {
    setCardCompact(false);
  }, [placeId]);

  // Anything that moves the route — a new place, a new start point, another
  // travel mode, the card opening or folding, or coming back to the Mapa tab —
  // asks the map to frame it again.
  useEffect(() => {
    setMapFocus("route");
    setFocusSeq((n) => n + 1);
  }, [placeId, origin?.lat, origin?.lon, mode, plan?.distanceM, cardCompact, tab]);

  useEffect(() => {
    if (!hydrated || origin) return;
    locate(true);
    // locate is stable enough for the first fix only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, origin]);

  const placeLat = place?.lat;
  const placeLon = place?.lon;

  useEffect(() => {
    if (!origin || placeLat == null || placeLon == null) {
      setPlan(null);
      setRouteError(null);
      return;
    }
    let live = true;
    setRouting(true);
    setRouteError(null);
    void planRoute({
      data: {
        fromLat: origin.lat,
        fromLon: origin.lon,
        toLat: placeLat,
        toLon: placeLon,
        mode,
      },
    })
      .then((result) => {
        if (!live) return;
        if (result.ok) setPlan(result.data);
        else {
          setPlan(null);
          setRouteError(result.error);
        }
      })
      .catch(() => {
        if (!live) return;
        setPlan(null);
        setRouteError("No pude trazar la ruta.");
      })
      .finally(() => {
        if (live) setRouting(false);
      });
    return () => {
      live = false;
    };
  }, [origin, placeId, placeLat, placeLon, mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchError(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(q);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query, origin?.lat, origin?.lon]);

  const markers = useMemo(
    () =>
      places.map((item) => ({
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        active: item.id === activeId,
        favorite: item.favorite,
      })),
    [places, activeId],
  );

  const focusKey = `${mapFocus}:${focusSeq}`;

  async function locate(silentFallback: boolean) {
    setGeoNote(null);
    if (!navigator.geolocation) {
      if (!usePlaces.getState().origin) setOrigin(FALLBACK_ORIGIN);
      setGeoNote("Este dispositivo no compartió la ubicación. Partimos de la Roma Norte.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          let label = "Tu ubicación";
          try {
            const named = await reverseLabel({ data: next });
            if (named.ok) label = named.data.label;
          } catch {
            label = "Tu ubicación";
          }
          setOrigin({ ...next, label, isDevice: true });
          setLocating(false);
          setGeoNote(null);
        })();
      },
      () => {
        setLocating(false);
        if (!usePlaces.getState().origin) setOrigin(FALLBACK_ORIGIN);
        if (!silentFallback || !usePlaces.getState().origin?.isDevice) {
          setGeoNote(
            "Ubicación no disponible. La partida queda en la Roma Norte; puedes cambiarla.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 45000 },
    );
  }

  async function runSearch(q: string) {
    setSearching(true);
    setSearchError(null);
    try {
      const here = usePlaces.getState().origin;
      const result = await searchPlaces({
        data: { q, ...(here ? { lat: here.lat, lon: here.lon } : {}) },
      });
      if (query.trim() !== q) return;
      if (result.ok) {
        const here = usePlaces.getState().origin;
        let data = result.data;
        if (here) {
          const ranked = [...data].sort((a, b) => crowFlies(here, a) - crowFlies(here, b));
          const close = ranked.filter((hit) => crowFlies(here, hit) < 60000);
          data = close.length > 0 ? close : ranked.slice(0, 5);
        }
        setHits(data);
      } else setSearchError(result.error);
    } catch {
      setSearchError("No se pudo buscar. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  async function runNearby() {
    const here = usePlaces.getState().origin;
    if (!here) {
      setSearchError("Primero elige un punto de partida.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setQuery("");
    try {
      const result = await nearbyPlaces({ data: { lat: here.lat, lon: here.lon } });
      if (result.ok) {
        setHits(result.data);
        if (result.data.length === 0)
          setSearchError("No hay restaurantes marcados cerca de este punto.");
      } else setSearchError(result.error);
    } catch {
      setSearchError("No pude consultar lugares cercanos.");
    } finally {
      setSearching(false);
    }
  }

  function remember(hit: GeoHit, go: boolean) {
    const already = usePlaces
      .getState()
      .places.some((item) => item.id === hit.id || same(item, hit));
    savePlace(hit);
    if (go) {
      setHits([]);
      setQuery("");
      toast.success(
        already ? "Ruta hacia un lugar que ya tenías" : "Lugar guardado y ruta en camino",
      );
    } else {
      toast.success(already ? "Ya estaba en tus lugares" : "Lugar agregado");
    }
  }

  function applyAsOrigin(hit: GeoHit) {
    setOrigin({ lat: hit.lat, lon: hit.lon, label: hit.name, isDevice: false });
    setGeoNote(null);
    toast.success("Punto de partida actualizado");
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <Toaster theme={theme} position="top-center" />
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none tracking-tight">
            Ruta<span className="text-primary italic">Gourmet</span>
          </p>
          <p className="mt-1 text-xs text-muted">A dónde ir, y cómo llegar</p>
        </div>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Secciones">
          {TABS.map((item) => (
            <TabButton
              key={item.id}
              active={tab === item.id}
              label={item.label}
              icon={item.icon}
              onClick={() => setTab(item.id)}
            />
          ))}
        </nav>
        <button
          type="button"
          className="press ml-auto grid size-11 place-items-center rounded-full border border-line bg-surface text-fg md:ml-0"
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          className={`${tab === "mapa" ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
        >
          <div ref={mapWrapRef} className="relative min-h-0 flex-1 overflow-hidden">
            <MapCanvas
              theme={theme}
              origin={origin}
              destination={place}
              route={plan?.geometry ?? null}
              markers={markers}
              focus={mapFocus}
              focusKey={focusKey}
              insets={mapInsets}
              onMarker={(id) => setActive(id)}
            />
            <div ref={mapTopRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
              <div className="pointer-events-auto">
                <form
                  className="rounded-3xl border border-line bg-surface p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (query.trim().length >= 2) void runSearch(query.trim());
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                      <label className="sr-only" htmlFor="buscar-lugar">
                        Agregar o buscar un lugar
                      </label>
                      <input
                        id="buscar-lugar"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Agregar restaurante o lugar"
                        className="h-11 w-full rounded-full border border-line bg-bg pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void runNearby()}
                      className="press h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
                    >
                      Cerca
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 px-1">
                    <MapPin className="size-4 shrink-0 text-good" />
                    <p className="min-w-0 flex-1 truncate text-xs text-muted">
                      {locating
                        ? "Buscando tu ubicación…"
                        : origin
                          ? `Partida: ${origin.label}`
                          : "Definir partida"}
                    </p>
                    <button
                      type="button"
                      onClick={() => void locate(false)}
                      className="press inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary"
                    >
                      <LocateFixed className="size-3.5" />
                      Actualizar
                    </button>
                  </div>
                </form>
                {geoNote ? (
                  <div className="rise mt-2 flex items-start gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-xs text-muted">
                    <p className="min-w-0 flex-1">{geoNote}</p>
                    <button
                      type="button"
                      className="press text-fg"
                      aria-label="Cerrar aviso"
                      onClick={() => setGeoNote(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}
                {searching ? (
                  <p className="mt-2 px-2 text-xs text-muted">Buscando en el mapa…</p>
                ) : null}
                {searchError ? (
                  <p className="mt-2 rounded-2xl bg-surface px-3 py-2 text-sm text-fg">
                    {searchError}
                  </p>
                ) : null}
                {hits.length > 0 ? (
                  <ul className="rise mt-2 max-h-52 space-y-2 overflow-y-auto rounded-3xl border border-line bg-surface p-2">
                    {hits.map((hit) => (
                      <li key={hit.id} className="rounded-2xl bg-bg px-3 py-2">
                        <p className="truncate text-sm font-medium">{hit.name}</p>
                        <p className="truncate text-xs text-muted">
                          {hit.category}
                          {hit.address ? ` · ${hit.address}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="press h-9 rounded-full border border-line px-3 text-xs"
                            onClick={() => applyAsOrigin(hit)}
                          >
                            Partida
                          </button>
                          <button
                            type="button"
                            className="press h-9 rounded-full border border-line px-3 text-xs"
                            onClick={() => remember(hit, false)}
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="press inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-fg"
                            onClick={() => remember(hit, true)}
                          >
                            <Navigation className="size-3.5" />
                            Cómo llegar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {place && hits.length === 0 ? (
              <div
                ref={mapBottomRef}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3"
              >
                <article className="rise pointer-events-auto max-h-64 overflow-y-auto rounded-3xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs tracking-wide text-muted uppercase">{place.category}</p>
                      <h2 className="font-display text-xl leading-tight">{place.name}</h2>
                      {cardCompact ? null : place.address ? (
                        <p className="mt-1 text-sm text-muted">{place.address}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="press grid size-10 shrink-0 place-items-center rounded-full text-muted"
                      aria-expanded={!cardCompact}
                      aria-label={
                        cardCompact ? "Ver todos los detalles" : "Minimizar la ficha y ver el mapa"
                      }
                      onClick={() => setCardCompact((open) => !open)}
                    >
                      {cardCompact ? (
                        <ChevronUp className="size-5" />
                      ) : (
                        <ChevronDown className="size-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="press grid size-10 shrink-0 place-items-center rounded-full text-muted"
                      aria-label="Cerrar ficha"
                      onClick={() => setActive(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm">
                    {routing
                      ? "Trazando la ruta…"
                      : plan
                        ? `${formatDuration(plan.durationS)} · ${formatDistance(plan.distanceM)}`
                        : origin
                          ? `${formatDistance(crowFlies(origin, place))} en línea recta`
                          : "Elige un punto de partida"}
                  </p>
                  {routeError ? <p className="mt-1 text-sm text-primary">{routeError}</p> : null}
                  {cardCompact ? null : (
                    <>
                      <div
                        className="mt-3 flex rounded-full bg-surface-2 p-1"
                        role="group"
                        aria-label="Modo de viaje"
                      >
                        {MODES.map((item) => {
                          const Icon = item.icon;
                          const on = mode === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setMode(item.id)}
                              className={`press inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full text-sm ${on ? "bg-surface text-fg" : "text-muted"}`}
                            >
                              <Icon className="size-4" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 divide-y divide-line">
                        <ToggleRow
                          label="Visitado"
                          hint="Márcalo cuando ya hayas ido"
                          checked={place.visited}
                          onChange={() => toggleVisited(place.id)}
                        />
                        <ToggleRow
                          label="Favorito"
                          hint={
                            place.visited && !place.favorite
                              ? "¿Te gustó? Déjalo en favoritos"
                              : "Para volver cuando quieras"
                          }
                          checked={place.favorite}
                          onChange={() => toggleFavorite(place.id)}
                        />
                      </div>
                      <label className="mt-2 block text-xs text-muted" htmlFor="nota-lugar">
                        Nota
                        <textarea
                          id="nota-lugar"
                          value={place.note}
                          maxLength={280}
                          onChange={(event) => setNote(place.id, event.target.value)}
                          placeholder="El mole, la mesa del fondo, ir en martes…"
                          className="mt-1 h-16 w-full resize-none rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </label>
                      {plan && plan.steps.length > 0 ? (
                        <details className="mt-2">
                          <summary className="text-sm font-medium text-primary">
                            Indicaciones
                          </summary>
                          <ol className="mt-2 space-y-2">
                            {plan.steps.map((step, index) => (
                              <li key={`${step.text}-${index}`} className="flex gap-2 text-sm">
                                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs text-muted">
                                  {index + 1}
                                </span>
                                <span>
                                  {step.text}
                                  <span className="text-muted">
                                    {" "}
                                    · {formatDistance(step.distanceM)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removePlace(place.id)}
                        className="press mt-3 inline-flex h-10 items-center gap-2 text-sm text-muted"
                      >
                        <Trash2 className="size-4" />
                        Quitar de mis lugares
                      </button>
                    </>
                  )}
                </article>
              </div>
            ) : null}

            {origin || place ? (
              <div
                className="pointer-events-none absolute right-3 z-10 flex flex-col items-end gap-2"
                style={{ bottom: mapInsets.bottom + 12 }}
              >
                {origin && place ? (
                  <button
                    type="button"
                    onClick={() => requestFocus("route")}
                    aria-pressed={mapFocus === "route"}
                    className="press pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg shadow-md"
                  >
                    <RouteIcon className="size-4 text-primary" />
                    Toda la ruta
                  </button>
                ) : null}
                {origin ? (
                  <button
                    type="button"
                    onClick={() => requestFocus("origin")}
                    aria-pressed={mapFocus === "origin"}
                    className="press pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg shadow-md"
                  >
                    <span className="pin-origin" aria-hidden="true" />
                    Ver partida
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside
          className={`${tab === "mapa" ? "hidden md:flex" : "flex"} min-h-0 w-full shrink-0 flex-col border-line bg-bg md:w-96 lg:w-[410px] md:border-l`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "favoritos" ? (
              <PlaceList
                title="Favoritos"
                intro="Los lugares que te gustaron se quedan en este teléfono."
                empty="Todavía no hay favoritos. Abre un lugar y enciende el interruptor."
                items={places.filter((item) => item.favorite)}
                origin={origin}
                onOpen={(id) => setActive(id)}
                onFavorite={toggleFavorite}
              />
            ) : tab === "qr" ? (
              <QrDownloadPanel />
            ) : tab === "privacidad" ? (
              <PrivacyPanel onNavigate={(target) => setTab(target)} />
            ) : tab === "ajustes" ? (
              <SettingsPanel
                onLocate={() => void locate(false)}
                locating={locating}
                onNavigate={(target) => setTab(target)}
                theme={theme}
                onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            ) : (
              <PlaceList
                title="Lugares"
                intro="Todo lo que quieres visitar, con visita y favorito por separado."
                empty="Agrega un restaurante desde el mapa con el buscador o con Cerca."
                items={places}
                origin={origin}
                onOpen={(id) => setActive(id)}
                onFavorite={toggleFavorite}
                showFilters
              />
            )}
          </div>
        </aside>
      </div>

      <nav
        className="safe-bottom flex shrink-0 border-t border-line bg-surface md:hidden"
        aria-label="Secciones"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`press flex h-16 flex-1 min-w-0 flex-col items-center justify-center gap-1 text-[11px] sm:text-xs ${
                on ? "text-primary font-semibold" : "text-muted"
              }`}
              aria-current={on ? "page" : undefined}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate max-w-full px-0.5">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function same(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return Math.abs(a.lat - b.lat) < 0.00025 && Math.abs(a.lon - b.lon) < 0.00025;
}

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof MapIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm ${active ? "bg-surface-2 text-fg" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={() => onChange()}
        aria-label={label}
        className="press relative h-7 w-12 shrink-0 rounded-full bg-line data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-surface transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-fg" />
      </Switch.Root>
    </div>
  );
}

function PlaceList({
  title,
  intro,
  empty,
  items,
  origin,
  onOpen,
  onFavorite,
  showFilters = false,
}: {
  title: string;
  intro: string;
  empty: string;
  items: Place[];
  origin: { lat: number; lon: number } | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState<"todos" | "pendientes" | "visitados">("todos");
  const visible = items.filter((item) => {
    if (!showFilters || filter === "todos") return true;
    if (filter === "visitados") return item.visited;
    return !item.visited;
  });

  return (
    <div className="rise">
      <h1 className="font-display text-3xl leading-none">{title}</h1>
      <p className="mt-2 text-sm text-muted">{intro}</p>
      {showFilters ? (
        <div className="mt-4 flex gap-2">
          {(
            [
              ["todos", "Todos"],
              ["pendientes", "Por visitar"],
              ["visitados", "Visitados"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`press h-9 rounded-full px-3 text-sm ${filter === id ? "bg-primary text-primary-fg" : "border border-line text-muted"}`}
              aria-pressed={filter === id}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line px-4 py-10 text-center">
          <Bookmark className="mx-auto size-6 text-muted" />
          <p className="mt-3 text-sm text-muted">{empty}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <article className="rounded-3xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted">
                      {item.category}
                      {item.visited ? " · Visitado" : " · Por visitar"}
                      {origin ? ` · ${formatDistance(crowFlies(origin, item))}` : ""}
                    </p>
                    {item.note ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{item.note}</p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label={item.favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                    aria-pressed={item.favorite}
                    onClick={() => onFavorite(item.id)}
                    className={`press grid size-11 place-items-center rounded-full border border-line ${item.favorite ? "text-primary" : "text-muted"}`}
                  >
                    <Heart className={`size-5 ${item.favorite ? "fill-current" : ""}`} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="press mt-3 inline-flex h-10 items-center gap-2 text-sm font-medium text-primary"
                >
                  <Navigation className="size-4" />
                  Cómo llegar
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsPanel({
  onLocate,
  locating,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  onLocate: () => void;
  locating: boolean;
  onNavigate: (tab: AppTab) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const origin = usePlaces((s) => s.origin);

  return (
    <div className="rise space-y-4">
      <h1 className="font-display text-3xl leading-none">Ajustes</h1>
      <p className="text-sm text-muted">Configuración local y preferencias de la aplicación.</p>

      {/* Punto de partida */}
      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-medium">Punto de partida</h2>
        <p className="mt-1 text-sm text-muted">
          {origin ? origin.label : "Todavía no hay un origen"}
        </p>
        <button
          type="button"
          onClick={onLocate}
          className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          <LocateFixed className="size-4" />
          {locating ? "Localizando…" : "Usar mi ubicación"}
        </button>
      </section>

      {/* Apariencia */}
      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-medium">Apariencia</h2>
        <p className="mt-1 text-sm text-muted">
          Modo actual:{" "}
          <span className="font-medium text-fg capitalize">
            {theme === "dark" ? "Oscuro" : "Claro"}
          </span>
        </p>
        <button
          type="button"
          onClick={onToggleTheme}
          className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm font-medium text-fg"
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-primary" />
          ) : (
            <Moon className="size-4 text-primary" />
          )}
          Cambiar a modo {theme === "dark" ? "claro" : "oscuro"}
        </button>
      </section>

      {/* Acceso a Descargar QR */}
      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-medium">Descargar e Instalar</h2>
        <p className="mt-1 text-sm text-muted">
          Escanea el código QR para instalar RutaGourmet en tu iPhone, Android o computadora.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("qr")}
          className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:border-primary/40"
        >
          <QrCode className="size-4 text-primary" />
          Abrir pestaña de QR / Descargar
        </button>
      </section>

      {/* Acceso a Políticas de Privacidad */}
      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-medium">Políticas de privacidad</h2>
        <p className="mt-1 text-sm text-muted">
          Conoce cómo protegemos tus datos, nuestro modelo 100% local y la ausencia de rastreadores.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("privacidad")}
          className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:border-good/40"
        >
          <ShieldCheck className="size-4 text-good" />
          Ver políticas de privacidad
        </button>
      </section>
    </div>
  );
}
