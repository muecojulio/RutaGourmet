import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
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
  UtensilsCrossed,
  X,
  Bookmark,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { MapCanvas, type MapFocus } from "@/components/map-canvas";
import type { MapInsets } from "@/lib/map-fit";
import { QrDownloadPanel } from "@/components/qr-download-panel";
import { PrivacyPanel } from "@/components/privacy-panel";
import { PlaceFinder } from "@/components/place-finder";
import { OriginSheet } from "@/components/origin-sheet";
import { AddPlaceSheet } from "@/components/add-place-sheet";
import { FavoritesView, PlaceList } from "@/components/place-list";
import { PlaceContext } from "@/components/place-context";
import { WeatherStrip } from "@/components/weather-strip";
import { Button } from "@/components/ui/button";
import { TabBar, TabPanel } from "@/components/ui/tabs";
import { usePanelSwipe } from "@/components/ui/use-panel-swipe";
import { Segmented } from "@/components/ui/segmented";
import { Collapse } from "@/components/ui/collapse";
import { Field, SwitchRow } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/hooks";
import { crowFlies, formatDistance, formatDuration } from "@/lib/format";
import { planRoute, reverseLabel, type GeoHit, type RoutePlan } from "@/lib/geo";
import { activePlace, usePlaces, type Place, type TravelMode } from "@/lib/places-store";
import { cn } from "@/lib/cn";

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

const TAB_IDS = TABS.map((tab) => tab.id) as unknown as string[];

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

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapTopRef = useRef<HTMLDivElement | null>(null);
  const mapBottomRef = useRef<HTMLDivElement | null>(null);
  const mapActionsRef = useRef<HTMLDivElement | null>(null);
  const asideScrollRef = useRef<HTMLDivElement | null>(null);

  const place = activePlace(places, activeId);
  const placeId = place?.id ?? null;

  /** On desktop the aside shows the Lugares list beside the map. */
  const asidePanel = tab === "mapa" ? "lugares" : tab;

  // Swipe between sections on touch (never over the map: the map owns its own
  // gestures). Tabs stay available as the explicit alternative.
  const swipe = usePanelSwipe({
    value: tab,
    ids: TAB_IDS,
    onChange: (id) => setTab(id as typeof tab),
    enabled: !isDesktop && tab !== "mapa",
  });

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
      <div className="backdrop-glow" aria-hidden="true" />
      <Toaster theme={theme} position="top-center" />

      <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 rotate-3 place-items-center rounded-2xl bg-gradient-to-br from-primary to-saffron text-primary-fg shadow-[var(--shadow-glow)]"
          >
            <UtensilsCrossed className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none tracking-tight">
              Ruta<span className="text-primary italic">Gourmet</span>
            </p>
            <p className="mt-1 text-xs text-muted">A dónde ir, y cómo llegar</p>
          </div>
        </div>
        <TabBar
          tabs={TABS}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          ariaLabel="Secciones"
          idBase="app"
          className="ml-auto hidden md:block"
        />
        <Button
          variant="surface"
          size="icon"
          className="ml-auto shrink-0 rounded-full md:ml-2"
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          id="app-panel-mapa"
          role="tabpanel"
          aria-labelledby="app-tab-mapa"
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            tab === "mapa" ? "flex" : "hidden md:flex",
          )}
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
              <div className="pointer-events-auto rounded-3xl border border-line bg-surface/95 p-2 shadow-[var(--shadow-card)] backdrop-blur">
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
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  </button>
                  <Button
                    variant="surface"
                    size="iconSm"
                    className="text-good"
                    aria-label="Usar mi ubicación como punto de partida"
                    onClick={() => void locate(false)}
                  >
                    <LocateFixed className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {geoNote ? (
                  <div
                    role="status"
                    className="rise mt-1 flex items-start gap-2 border-t border-line px-2 pt-2 pb-1 text-xs text-muted"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden="true" />
                    <p className="min-w-0 flex-1 line-clamp-2" title={geoNote}>
                      {geoNote}
                    </p>
                    <button
                      type="button"
                      className="press -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-fg"
                      aria-label="Cerrar aviso"
                      onClick={() => setGeoNote(null)}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                {origin ? <WeatherStrip lat={origin.lat} lon={origin.lon} /> : null}
              </div>
            </div>

            {place && !resultsOpen ? (
              <div
                ref={mapBottomRef}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3"
              >
                <PlaceCard
                  place={place}
                  origin={origin}
                  compact={cardCompact}
                  onToggleCompact={() => setCardCompact((open) => !open)}
                  onClose={() => setActive(null)}
                  mode={mode}
                  onMode={setMode}
                  plan={plan}
                  routing={routing}
                  routeError={routeError}
                  onVisited={() => toggleVisited(place.id)}
                  onFavorite={() => toggleFavorite(place.id)}
                  onNote={(note) => setNote(place.id, note)}
                  onRemove={() => removePlace(place.id)}
                />
              </div>
            ) : null}

            <div
              ref={mapActionsRef}
              className="pointer-events-none absolute right-3 z-10 flex flex-col items-end gap-2"
              style={{ bottom: mapInsets.bottom + 12 }}
            >
              <Button
                size="md"
                className="pointer-events-auto rounded-full shadow-md"
                leading={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setAddOpen(true)}
              >
                Agregar lugar
              </Button>
              {origin && place ? (
                <Button
                  variant="surface"
                  size="sm"
                  aria-pressed={mapFocus === "route"}
                  className="pointer-events-auto rounded-full shadow-md"
                  leading={<RouteIcon className="size-4 text-primary" aria-hidden="true" />}
                  onClick={() => requestFocus("route")}
                >
                  Toda la ruta
                </Button>
              ) : null}
              {origin ? (
                <Button
                  variant="surface"
                  size="sm"
                  aria-pressed={mapFocus === "origin"}
                  className="pointer-events-auto rounded-full shadow-md"
                  leading={<span className="pin-origin" aria-hidden="true" />}
                  onClick={() => requestFocus("origin")}
                >
                  Ver partida
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-line bg-bg md:flex md:w-96 md:border-l lg:w-[410px]",
            tab === "mapa" ? "hidden" : "flex",
          )}
        >
          <div
            ref={asideScrollRef}
            {...swipe.handlers}
            style={swipe.dragStyle}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          >
            <TabPanel
              idBase="app"
              tabId="lugares"
              labelledBy="heading-lugares"
              active={asidePanel === "lugares"}
              className="pb-6"
            >
              <PlaceList
                headingId="heading-lugares"
                title="Lugares"
                icon={<Bookmark className="size-7 text-accent" aria-hidden="true" />}
                intro="Todo lo que quieres visitar, con visita y favorito por separado."
                empty="Agrega un restaurante desde el mapa con el buscador o con Cerca."
                items={places}
                origin={origin}
                onOpen={(id) => setActive(id)}
                onFavorite={toggleFavorite}
                onRemove={(id) => {
                  removePlace(id);
                  toast.success("Lugar quitado");
                }}
                onAdd={() => setAddOpen(true)}
                showFilters
              />
            </TabPanel>
            <TabPanel
              idBase="app"
              tabId="favoritos"
              labelledBy="heading-favoritos"
              active={asidePanel === "favoritos"}
              className="pb-6"
            >
              <FavoritesView
                headingId="heading-favoritos"
                places={places}
                origin={origin}
                onOpen={(id) => setActive(id)}
                onFavorite={toggleFavorite}
                onRemove={(id) => {
                  removePlace(id);
                  toast.success("Lugar quitado");
                }}
              />
            </TabPanel>
            <TabPanel
              idBase="app"
              tabId="qr"
              labelledBy="heading-qr"
              active={asidePanel === "qr"}
              className="pb-6"
            >
              <QrDownloadPanel />
            </TabPanel>
            <TabPanel
              idBase="app"
              tabId="privacidad"
              labelledBy="heading-privacidad"
              active={asidePanel === "privacidad"}
              className="pb-6"
            >
              <div id="heading-privacidad">
                <PrivacyPanel onNavigate={(target) => setTab(target)} />
              </div>
            </TabPanel>
          </div>
        </aside>
      </div>

      <nav
        className="safe-bottom relative z-20 flex shrink-0 border-t border-line bg-surface/95 backdrop-blur md:hidden"
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
              className={cn(
                "press relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] sm:text-xs",
                on ? "text-primary font-semibold" : "text-muted",
              )}
              aria-current={on ? "page" : undefined}
              aria-controls={`app-panel-${item.id === "mapa" ? "mapa" : item.id}`}
            >
              {/* Active pill that scales in from the top edge. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-0 h-1 w-8 origin-center rounded-full bg-primary transition-transform duration-200",
                  on ? "scale-x-100" : "scale-x-0",
                )}
              />
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-transform duration-200",
                  on && "scale-110",
                )}
                aria-hidden="true"
              />
              <span className="max-w-full truncate px-0.5">{item.shortLabel}</span>
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

/** The floating detail card over the map for the active place. */
function PlaceCard({
  place,
  origin,
  compact,
  onToggleCompact,
  onClose,
  mode,
  onMode,
  plan,
  routing,
  routeError,
  onVisited,
  onFavorite,
  onNote,
  onRemove,
}: {
  place: Place;
  origin: { lat: number; lon: number } | null;
  compact: boolean;
  onToggleCompact: () => void;
  onClose: () => void;
  mode: TravelMode;
  onMode: (mode: TravelMode) => void;
  plan: RoutePlan | null;
  routing: boolean;
  routeError: string | null;
  onVisited: () => void;
  onFavorite: () => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  return (
    <article
      className="rise pointer-events-auto max-h-72 overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface/95 p-4 shadow-[var(--shadow-pop)] backdrop-blur"
      aria-label={`Lugar: ${place.name}`}
      data-no-swipe
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted uppercase">{place.category}</p>
          <h2 className="font-display text-xl leading-tight">{place.name}</h2>
          {compact ? null : place.address ? (
            <p className="mt-1 text-sm text-muted">{place.address}</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="iconSm"
          aria-expanded={!compact}
          aria-label={compact ? "Ver todos los detalles" : "Minimizar la ficha y ver el mapa"}
          onClick={onToggleCompact}
        >
          {compact ? (
            <ChevronUp className="size-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-5" aria-hidden="true" />
          )}
        </Button>
        <Button variant="ghost" size="iconSm" aria-label="Cerrar ficha" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <p className="mt-2 text-sm" aria-live="polite" role={routing ? "status" : undefined}>
        {routing ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-primary pulse-soft" aria-hidden="true" />
            Trazando la ruta…
          </span>
        ) : plan ? (
          <>
            <strong className="text-primary">{formatDuration(plan.durationS)}</strong>
            <span className="text-muted"> · {formatDistance(plan.distanceM)}</span>
          </>
        ) : origin ? (
          <span className="text-muted">
            {formatDistance(crowFlies(origin, place))} en línea recta
          </span>
        ) : (
          <span className="text-muted">Elige un punto de partida</span>
        )}
      </p>
      {routeError ? (
        <p role="alert" className="wiggle mt-1 text-sm text-primary">
          ⚠ {routeError}
        </p>
      ) : null}

      {compact ? null : (
        <>
          <Segmented
            label="Modo de viaje"
            className="mt-3"
            size="sm"
            value={mode}
            onChange={onMode}
            options={MODES.map((item) => {
              const Icon = item.icon;
              return {
                id: item.id,
                label: item.label,
                icon: <Icon className="size-4" aria-hidden="true" />,
              };
            })}
          />

          <div className="mt-3 divide-y divide-line">
            <SwitchRow
              label="Visitado"
              hint="Márcalo cuando ya hayas ido"
              checked={place.visited}
              onToggle={onVisited}
            />
            <SwitchRow
              label="Favorito"
              hint={
                place.visited && !place.favorite
                  ? "¿Te gustó? Déjalo en favoritos"
                  : "Para volver cuando quieras"
              }
              checked={place.favorite}
              onToggle={onFavorite}
            />
          </div>

          <Field label="Nota" hint="El mole, la mesa del fondo, ir en martes…" className="mt-2">
            {({ id, describedBy, invalid }) => (
              <textarea
                id={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                value={place.note}
                maxLength={280}
                onChange={(event) => onNote(event.target.value)}
                placeholder="El mole, la mesa del fondo, ir en martes…"
                className={cn(inputClass, "h-16 resize-none py-2")}
              />
            )}
          </Field>

          {plan && plan.steps.length > 0 ? (
            <Collapse
              title="Indicaciones"
              subtitle={`${plan.steps.length} pasos`}
              className="mt-2"
              icon={<Navigation className="size-4" />}
            >
              <ol className="space-y-2">
                {plan.steps.map((step, index) => (
                  <li key={`${step.text}-${index}`} className="flex gap-2 text-sm">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs text-muted">
                      {index + 1}
                    </span>
                    <span>
                      {step.text}
                      <span className="text-muted"> · {formatDistance(step.distanceM)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Collapse>
          ) : null}

          <PlaceContext lat={place.lat} lon={place.lon} />

          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-3 text-muted hover:text-danger"
            leading={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={onRemove}
          >
            Quitar de mis lugares
          </Button>
        </>
      )}
    </article>
  );
}
