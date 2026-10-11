import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  active: boolean;
  favorite: boolean;
};

type Props = {
  theme: "dark" | "light";
  origin: { lat: number; lon: number } | null;
  destination: { lat: number; lon: number } | null;
  route: Array<[number, number]> | null;
  markers: MapMarker[];
  focusKey: string;
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

export function MapCanvas({
  theme,
  origin,
  destination,
  route,
  markers,
  focusKey,
  onMarker,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const onMarkerRef = useRef(onMarker);
  const [ready, setReady] = useState(false);
  onMarkerRef.current = onMarker;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    let map: LeafletMap | null = null;

    void loadLeaflet().then((L) => {
      if (dead || !holder.current) return;
      map = L.map(holder.current, { zoomControl: false, attributionControl: true }).setView(
        [19.4326, -99.1332],
        12,
      );
      if (window.innerWidth >= 768) {
        L.control.zoom({ position: "topright" }).addTo(map);
      }
      tilesRef.current = L.tileLayer(tileUrl(theme), {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
      const fix = () => map?.invalidateSize();
      requestAnimationFrame(fix);
      window.setTimeout(fix, 250);
      const observer = new ResizeObserver(() => fix());
      observer.observe(holder.current);
      (map as LeafletMap & { __observer?: ResizeObserver }).__observer = observer;
    });

    return () => {
      dead = true;
      map?.remove();
      (map as (LeafletMap & { __observer?: ResizeObserver }) | null)?.__observer?.disconnect();
      mapRef.current = null;
      tilesRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
    // Theme is applied by the next effect once the map exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    void loadLeaflet().then((L) => {
      tilesRef.current?.remove();
      tilesRef.current = L.tileLayer(tileUrl(theme), {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
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
            html: '<div class="pin-origin"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(layerRef.current);
      }

      for (const marker of markers) {
        const klass = marker.active ? "pin-active" : marker.favorite ? "pin pin-fav" : "pin";
        const size = marker.active ? 18 : 14;
        const pin = L.marker([marker.lat, marker.lon], {
          title: "Lugar guardado",
          icon: L.divIcon({
            className: "pin-wrap",
            html: `<div class="${klass}"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        });
        pin.on("click", () => onMarkerRef.current(marker.id));
        pin.addTo(layerRef.current);
      }

      if (route && route.length > 1) {
        mapRef.current.fitBounds(L.latLngBounds(route), { padding: [36, 36], maxZoom: 16 });
      } else if (destination) {
        mapRef.current.setView([destination.lat, destination.lon], 16);
      } else if (origin) {
        mapRef.current.setView([origin.lat, origin.lon], 15);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, route, markers, focusKey, ready]);

  return <div ref={holder} className="h-full min-h-64 w-full" role="application" aria-label="Mapa" />;
}
