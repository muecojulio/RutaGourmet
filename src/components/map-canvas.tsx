import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { fitPadding, type MapInsets } from "@/lib/map-fit";

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  active: boolean;
  favorite: boolean;
};

/** What the map frames when it (re)fits the view. */
export type MapFocus = "route" | "origin" | "destination";

type Props = {
  theme: "dark" | "light";
  origin: { lat: number; lon: number } | null;
  destination: { id?: string; lat: number; lon: number } | null;
  route: Array<[number, number]> | null;
  markers: MapMarker[];
  focus: MapFocus;
  /** Changes whenever the caller wants the view framed again. */
  focusKey: string;
  /** Pixels of the map the floating panels cover, top and bottom. */
  insets: MapInsets;
  onMarker: (id: string) => void;
};

type LeafletNs = typeof import("leaflet");

async function loadLeaflet(): Promise<LeafletNs> {
  const mod = (await import("leaflet")) as LeafletNs & { default?: LeafletNs };
  return mod.default ?? mod;
}

function tileUrl(theme: "dark" | "light") {
  return theme === "light"
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png";
}

function tokenColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#e07a45";
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO';

/** Dot and label metrics — keep in sync with `.pin*` / `.pin-pair` in styles.css. */
const ORIGIN_DOT = 16;
const PLACE_DOT = 14;
const ACTIVE_DOT = 18;
const PIN_ROW = 20;
const LABEL_ROOM = 72;

function pair(html: string) {
  return `<span class="pin-pair">${html}</span>`;
}

function label(text: string, kind: "origin" | "destination") {
  return `<span class="pin-label pin-label-${kind}">${text}</span>`;
}

export function MapCanvas({
  theme,
  origin,
  destination,
  route,
  markers,
  focus,
  focusKey,
  insets,
  onMarker,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletNs | null>(null);
  const onMarkerRef = useRef(onMarker);
  const [ready, setReady] = useState(false);
  const latest = useRef({ origin, destination, route, focus, insets });
  latest.current = { origin, destination, route, focus, insets };
  onMarkerRef.current = onMarker;

  /**
   * Frame the current focus inside the strip the floating panels leave free, so
   * the start point never lands underneath the search panel or the detail card.
   */
  const applyFocus = useCallback((map: LeafletMap) => {
    const L = leafletRef.current;
    if (!L) return;
    const state = latest.current;
    const size = map.getSize();
    // A hidden tab has no size yet; the ResizeObserver refits once it appears.
    if (size.x < 2 || size.y < 2) return;

    const single = (point: { lat: number; lon: number }) =>
      L.latLngBounds([point.lat, point.lon], [point.lat, point.lon]);

    const bounds =
      state.focus === "origin" && state.origin
        ? single(state.origin)
        : state.focus === "destination" && state.destination
          ? single(state.destination)
          : state.route && state.route.length > 1
            ? L.latLngBounds(state.route)
            : state.destination
              ? single(state.destination)
              : state.origin
                ? single(state.origin)
                : null;
    if (!bounds) return;

    const padding = fitPadding({ width: size.x, height: size.y }, state.insets);
    // maxZoom is required for single-point bounds: without it Leaflet refuses to
    // fit degenerate bounds and the padding offset is silently dropped.
    map.fitBounds(bounds, { ...padding, maxZoom: state.focus === "route" ? 16 : 17 });
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    let map: LeafletMap | null = null;
    let size = { x: 0, y: 0 };

    void loadLeaflet().then((L) => {
      if (dead || !holder.current) return;
      leafletRef.current = L;
      map = L.map(holder.current, { zoomControl: false, attributionControl: false }).setView(
        [19.4326, -99.1332],
        12,
      );
      if (window.innerWidth >= 768) {
        L.control.zoom({ position: "topright" }).addTo(map);
      }
      // Credited bottom-left so the floating route controls keep the right edge.
      L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
      tilesRef.current = L.tileLayer(tileUrl(theme), {
        attribution: ATTRIBUTION,
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);

      const sync = () => {
        if (!map || dead) return;
        map.invalidateSize();
        const next = map.getSize();
        const changed = next.x !== size.x || next.y !== size.y;
        size = { x: next.x, y: next.y };
        // Re-frame after a rotation, a window resize or when the Mapa tab comes
        // back into view — a fit computed on a 0×0 container is meaningless.
        if (changed && next.x > 1 && next.y > 1) applyFocus(map);
      };
      const observer = new ResizeObserver(() => {
        sync();
      });
      observer.observe(el);
      const fix = () => sync();
      requestAnimationFrame(fix);
      window.setTimeout(fix, 250);
      (map as LeafletMap & { __observer?: ResizeObserver }).__observer = observer;
    });

    return () => {
      dead = true;
      map?.remove();
      (map as (LeafletMap & { __observer?: ResizeObserver }) | null)?.__observer?.disconnect();
      mapRef.current = null;
      tilesRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
    // Theme is applied by the next effect once the map exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-frame on a rAF so insets measured in this same commit are already applied.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const raf = requestAnimationFrame(() => applyFocus(map));
    return () => cancelAnimationFrame(raf);
  }, [focusKey, focus, route, ready, applyFocus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    void loadLeaflet().then((L) => {
      tilesRef.current?.remove();
      tilesRef.current = L.tileLayer(tileUrl(theme), {
        attribution: ATTRIBUTION,
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);
    });
  }, [theme, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group || !ready) return;
    let cancelled = false;

    void loadLeaflet().then((L) => {
      if (cancelled || !layerRef.current || !mapRef.current) return;
      layerRef.current.clearLayers();
      const primary = tokenColor("--color-primary");

      if (route && route.length > 1) {
        L.polyline(route, { color: primary, weight: 5, opacity: 0.92 }).addTo(layerRef.current);
      }

      if (origin) {
        L.marker([origin.lat, origin.lon], {
          interactive: false,
          keyboard: false,
          title: "Punto de partida",
          icon: L.divIcon({
            className: "pin-wrap",
            html: pair(`<span class="pin-origin"></span>${label("Partida", "origin")}`),
            iconSize: [ORIGIN_DOT + LABEL_ROOM, PIN_ROW],
            iconAnchor: [ORIGIN_DOT / 2, PIN_ROW / 2],
          }),
        }).addTo(layerRef.current);
      }

      // Saved pins first, the active one last so the destination stays on top.
      const ordered = [...markers].sort((a, b) => Number(a.active) - Number(b.active));
      for (const marker of ordered) {
        const isDestination = marker.active && Boolean(destination);
        const klass = marker.active ? "pin pin-active" : marker.favorite ? "pin pin-fav" : "pin";
        const dot = marker.active ? ACTIVE_DOT : PLACE_DOT;
        const html = isDestination
          ? pair(`<span class="${klass}"></span>${label("Destino", "destination")}`)
          : `<span class="${klass}"></span>`;
        const pin = L.marker([marker.lat, marker.lon], {
          title: marker.active ? "Destino" : "Lugar guardado",
          icon: L.divIcon({
            className: "pin-wrap",
            html,
            iconSize: [dot + LABEL_ROOM, PIN_ROW],
            iconAnchor: [dot / 2, PIN_ROW / 2],
          }),
        });
        pin.on("click", () => onMarkerRef.current(marker.id));
        pin.addTo(layerRef.current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, route, markers, ready]);

  return (
    <div
      ref={holder}
      className="h-full min-h-40 w-full"
      role="application"
      aria-label="Mapa de la ruta"
    />
  );
}
