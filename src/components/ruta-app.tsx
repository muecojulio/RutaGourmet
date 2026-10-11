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
  Plus,
  QrCode,
  Route as RouteIcon,
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
import { PlaceFinder } from "@/components/place-finder";
import { OriginSheet } from "@/components/origin-sheet";
import { AddPlaceSheet } from "@/components/add-place-sheet";
import { crowFlies, formatDistance, formatDuration } from "@/lib/format";
import { planRoute, reverseLabel, type GeoHit, type RoutePlan } from "@/lib/geo";
import { activePlace, usePlaces, type Place, type TravelMode } from "@/lib/places-store";
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
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [cardCompact, setCardCompact] = useState(false);
  const [mapInsets, setMapInsets] = useState<MapInsets>({ top: 0, bottom: 0, right: 0 });
  const [mapFocus, setMapFocus] = useState<MapFocus>("route");
  const [focusSeq, setFocusSeq] = useState(0);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapTopRef = useRef<HTMLDivElement | null>(null);
  const mapBottomRef = useRef<HTMLDivElement | null>(null);
  const mapActionsRef = useRef<HTMLDivElement | null>(null);

  const place = activePlace(places, activeId);
  const placeId = place?.id ?? null;
  const favorites = useMemo(() => places.filter((item) => item.favorite), [places]);
  const visitedCount = places.filter((item) => item.visited).length;

  const requestFocus = useCallback((target: MapFocus) => {
    setMapFocus(target);
    setFocusSeq((n) => n + 1);
  }, []);

  const handleResults = useCallback((count: number) => setResultsOpen(count > 0), []);

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
      // The floating buttons are right-aligned, so the strip they cover runs
      // from their left edge to the map's right edge.
      const actionsEdge = mapActionsRef.current?.getBoundingClientRect().left;
      const next: MapInsets = {
        top: topEdge == null ? 0 : Math.max(0, Math.round(topEdge - base.top)),
        bottom: bottomEdge == null ? 0 : Math.max(0, Math.round(base.bottom - bottomEdge)),
        right: actionsEdge == null ? 0 : Math.max(0, Math.round(base.right - actionsEdge)),
      };
      setMapInsets((prev) =>
        prev.top === next.top && prev.bottom === next.bottom && prev.right === next.right
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (mapTopRef.current) observer.observe(mapTopRef.current);
    if (mapBottomRef.current) observer.observe(mapBottomRef.current);
    if (mapActionsRef.current) observer.observe(mapActionsRef.current);
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
  }, [placeId, origin?.lat, origin?.lon, mode, plan?.distanceM, cardCompact, resultsOpen, tab]);

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
      fromLat: origin.lat,
      fromLon: origin.lon,
      toLat: placeLat,
      toLon: placeLon,
      mode,
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
      setGeoNote("Sin GPS en este dispositivo; partimos de Roma Norte.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          let label = "Tu ubicación";
          try {
            const named = await reverseLabel(next);
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
          setGeoNote("Sin permiso de ubicación; partida en Roma Norte.");
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 45000 },
    );
  }

  function remember(hit: GeoHit, go: boolean) {
    const already = usePlaces
      .getState()
      .places.some((item) => item.id === hit.id || same(item, hit));
    savePlace(hit);
    if (go) {
      toast.success(already ? "Ruta hacia un lugar que ya tenías" : "Lugar guardado y ruta en camino");
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
              <div className="pointer-events-auto rounded-3xl border border-line bg-surface p-2">
                <PlaceFinder
                  idPrefix="mapa"
                  variant="bare"
                  showNearby
                  onSave={(hit) => remember(hit, false)}
                  onPick={(hit) => remember(hit, true)}
                  pickLabel="Cómo llegar"
                  onOrigin={applyAsOrigin}
                  onResults={handleResults}
                />
                <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
                  <button
                    type="button"
                    onClick={() => setOriginOpen(true)}
                    className="press flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2 py-1.5 text-left"
                    data-testid="punto-de-partida"
                  >
                    <span className="pin-origin" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] tracking-wide text-muted uppercase">
                        Punto de partida
                      </span>
                      <span className="block truncate text-sm font-medium">
                        {locating
                          ? "Buscando tu ubicación…"
                          : origin
                            ? origin.label
                            : "Elegir de dónde sales"}
                      </span>
                    </span>
                    <MapPin className="size-4 shrink-0 text-primary" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void locate(false)}
                    aria-label="Usar mi ubicación como punto de partida"
                    className="press grid size-10 shrink-0 place-items-center rounded-full border border-line text-good"
                  >
                    <LocateFixed className="size-4" />
                  </button>
                </div>
                {geoNote ? (
                  <div className="rise mt-1 flex items-start gap-2 border-t border-line px-2 pt-2 pb-1 text-xs text-muted">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden="true" />
                    <p className="min-w-0 flex-1 line-clamp-2" title={geoNote}>
                      {geoNote}
                    </p>
                    <button
                      type="button"
                      className="press -mt-1 grid size-6 shrink-0 place-items-center rounded-full text-fg"
                      aria-label="Cerrar aviso"
                      onClick={() => setGeoNote(null)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {place && !resultsOpen ? (
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
                          <summary className="text-sm font-medium text-primary">Indicaciones</summary>
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

            <div
              ref={mapActionsRef}
              className="pointer-events-none absolute right-3 z-10 flex flex-col items-end gap-2"
              style={{ bottom: mapInsets.bottom + 12 }}
            >
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="press pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg shadow-md"
              >
                <Plus className="size-4" />
                Agregar lugar
              </button>
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
          </div>
        </section>

        <aside
          className={`${tab === "mapa" ? "hidden md:flex" : "flex"} min-h-0 w-full shrink-0 flex-col border-line bg-bg md:w-96 lg:w-[410px] md:border-l`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "favoritos" ? (
              <>
                <PlaceList
                  title="Favoritos"
                  intro={
                    places.length === 0
                      ? "Los lugares que te gustaron se quedan en este teléfono."
                      : `${favorites.length} de ${places.length} lugares, y ${visitedCount} ya visitados.`
                  }
                  empty="Todavía no hay favoritos. Abre un lugar en el mapa y enciende el interruptor, o toca el corazón de la lista."
                  items={favorites}
                  origin={origin}
                  onOpen={(id) => setActive(id)}
                  onFavorite={toggleFavorite}
                />
                <VisitedSuggestions
                  places={places}
                  onOpen={(id) => setActive(id)}
                  onFavorite={toggleFavorite}
                />
              </>
            ) : tab === "qr" ? (
              <QrDownloadPanel />
            ) : tab === "privacidad" ? (
              <PrivacyPanel onNavigate={(target) => setTab(target)} />
            ) : (
              <PlaceList
                title="Lugares"
                intro="Todo lo que quieres visitar, con visita y favorito por separado."
                empty="Agrega un restaurante desde el mapa con el buscador o con Cerca."
                items={places}
                origin={origin}
                onOpen={(id) => setActive(id)}
                onFavorite={toggleFavorite}
                onAdd={() => setAddOpen(true)}
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

      <OriginSheet
        open={originOpen}
        onOpenChange={setOriginOpen}
        locating={locating}
        onUseDevice={() => void locate(false)}
        onPick={(hit) => {
          applyAsOrigin(hit);
          setOriginOpen(false);
        }}
        note={geoNote}
      />
      <AddPlaceSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(hit) => remember(hit, false)}
        onRoute={(hit) => remember(hit, true)}
        onOrigin={applyAsOrigin}
      />
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

/**
 * Marking a place as visited is the moment you know whether you liked it, so
 * the Favoritos tab offers the ones that are still missing the heart.
 */
function VisitedSuggestions({
  places,
  onOpen,
  onFavorite,
}: {
  places: Place[];
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
}) {
  const pending = places.filter((item) => item.visited && !item.favorite);
  if (pending.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        Visitados que te pueden gustar
      </h2>
      <p className="mt-1 text-xs text-muted">
        Ya fuiste. Si te gustaron, agrégalos a favoritos para tenerlos a mano.
      </p>
      <ul className="mt-3 space-y-2">
        {pending.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
          >
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted">
                {item.category} · Visitado
              </span>
            </button>
            <button
              type="button"
              onClick={() => onFavorite(item.id)}
              className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-fg"
            >
              <Heart className="size-4" />
              Favorito
            </button>
          </li>
        ))}
      </ul>
    </section>
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
  onAdd,
  showFilters = false,
}: {
  title: string;
  intro: string;
  empty: string;
  items: Place[];
  origin: { lat: number; lon: number } | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onAdd?: () => void;
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
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="press mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-fg"
        >
          <Plus className="size-4" />
          Agregar lugar
        </button>
      ) : null}
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
