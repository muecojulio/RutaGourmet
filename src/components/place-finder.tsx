import { useEffect, useRef, useState } from "react";
import { Navigation, Plus, Search, X } from "lucide-react";
import { nearbyPlaces, rankByDistance, searchPlaces, type GeoHit } from "@/lib/geo";
import { usePlaces } from "@/lib/places-store";

export type PlaceFinderProps = {
  /** Unique prefix so two finders mounted at once never share an input id. */
  idPrefix: string;
  /** Main action per result, e.g. "Cómo llegar" or "Usar como partida". */
  onPick?: (hit: GeoHit) => void;
  pickLabel?: string;
  pickIcon?: typeof Navigation;
  onSave?: (hit: GeoHit) => void;
  onOrigin?: (hit: GeoHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showNearby?: boolean;
  /** "card" paints its own panel; "bare" nests inside one. */
  variant?: "card" | "bare";
  className?: string;
  /** Told how many results are on screen, so the map can hide its place card. */
  onResults?: (count: number) => void;
};

/**
 * Type a name, get places. Shared by the map panel, the "Agregar lugar" sheet
 * and the "Punto de partida" sheet so search behaves the same everywhere: same
 * debounce, same ranking around the current start point, same result actions.
 */
export function PlaceFinder({
  idPrefix,
  onPick,
  pickLabel = "Cómo llegar",
  pickIcon: PickIcon = Navigation,
  onSave,
  onOrigin,
  placeholder = "Agregar restaurante o lugar",
  autoFocus = false,
  showNearby = false,
  variant = "card",
  className = "",
  onResults,
}: PlaceFinderProps) {
  const origin = usePlaces((s) => s.origin);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  /** Only the newest request may write to the list, so late replies can't win. */
  const requestRef = useRef(0);

  useEffect(() => {
    onResults?.(hits.length);
  }, [hits.length, onResults]);

  const originLat = origin?.lat;
  const originLon = origin?.lon;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      requestRef.current += 1;
      setHits([]);
      setError(null);
      setSearched(false);
      setBusy(false);
      return;
    }
    const id = requestRef.current + 1;
    requestRef.current = id;
    const timer = window.setTimeout(() => {
      void runSearch(q, id);
    }, 320);
    return () => window.clearTimeout(timer);
    // `runSearch` reads the live origin from state, so the coordinates are the
    // only extra dependency it needs.
  }, [query, originLat, originLon]);

  function clear() {
    requestRef.current += 1;
    setQuery("");
    setHits([]);
    setError(null);
    setSearched(false);
    setBusy(false);
  }

  async function runSearch(q: string, id: number) {
    setBusy(true);
    setError(null);
    try {
      const here = usePlaces.getState().origin;
      const result = await searchPlaces({ q, ...(here ? { lat: here.lat, lon: here.lon } : {}) });
      if (requestRef.current !== id) return;
      if (result.ok) {
        const live = usePlaces.getState().origin;
        setHits(live ? rankByDistance(result.data, live) : result.data);
        setSearched(true);
        if (result.data.length === 0) setError("Sin resultados por aquí. Prueba con otro nombre.");
      } else setError(result.error);
    } catch {
      if (requestRef.current === id) setError("No se pudo buscar. Intenta de nuevo.");
    } finally {
      if (requestRef.current === id) setBusy(false);
    }
  }

  async function runNearby() {
    const here = usePlaces.getState().origin;
    if (!here) {
      setError("Primero elige un punto de partida.");
      return;
    }
    const id = requestRef.current + 1;
    requestRef.current = id;
    setBusy(true);
    setError(null);
    setQuery("");
    try {
      const result = await nearbyPlaces(here);
      if (requestRef.current !== id) return;
      if (result.ok) {
        setHits(result.data);
        setSearched(true);
        if (result.data.length === 0)
          setError("No hay restaurantes marcados cerca de este punto.");
      } else setError(result.error);
    } catch {
      if (requestRef.current === id) setError("No pude consultar lugares cercanos.");
    } finally {
      if (requestRef.current === id) setBusy(false);
    }
  }

  /** Results with a "next step" action (route, new start point) close the list. */
  function pick(action: ((hit: GeoHit) => void) | undefined, hit: GeoHit) {
    if (!action) return;
    action(hit);
    clear();
  }

  return (
    <div
      className={`${variant === "card" ? "rounded-3xl border border-line bg-surface p-2" : ""} ${className}`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const q = query.trim();
          if (q.length < 2) return;
          const id = requestRef.current + 1;
          requestRef.current = id;
          void runSearch(q, id);
        }}
      >
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <label className="sr-only" htmlFor={`${idPrefix}-q`}>
              {placeholder}
            </label>
            <input
              id={`${idPrefix}-q`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="h-11 w-full rounded-full border border-line bg-bg pr-10 pl-10 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary"
              autoComplete="off"
              autoFocus={autoFocus}
            />
            {query ? (
              <button
                type="button"
                onClick={clear}
                aria-label="Limpiar búsqueda"
                className="press absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          {showNearby ? (
            <button
              type="button"
              onClick={() => void runNearby()}
              className="press inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              <Plus className="size-4" />
              Cerca
            </button>
          ) : null}
        </div>
      </form>
      {busy ? <p className="mt-2 px-2 text-xs text-muted">Buscando en el mapa…</p> : null}
      {error ? (
        <p className="mt-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-fg">{error}</p>
      ) : null}
      {!busy && !error && searched && hits.length === 0 ? (
        <p className="mt-2 px-2 text-xs text-muted">
          Nada por aquí. Prueba con el nombre del restaurante o del barrio.
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="rise mt-2 max-h-64 space-y-2 overflow-y-auto rounded-3xl border border-line bg-surface p-2">
          {hits.map((hit) => (
            <li key={hit.id} className="rounded-2xl bg-bg px-3 py-2">
              <p className="truncate text-sm font-medium">{hit.name}</p>
              <p className="truncate text-xs text-muted">
                {hit.category}
                {hit.address ? ` · ${hit.address}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onOrigin ? (
                  <button
                    type="button"
                    className="press h-9 rounded-full border border-line px-3 text-xs"
                    onClick={() => pick(onOrigin, hit)}
                  >
                    Partida
                  </button>
                ) : null}
                {onSave ? (
                  <button
                    type="button"
                    className="press h-9 rounded-full border border-line px-3 text-xs"
                    onClick={() => onSave(hit)}
                  >
                    Guardar
                  </button>
                ) : null}
                {onPick ? (
                  <button
                    type="button"
                    className="press inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-fg"
                    onClick={() => pick(onPick, hit)}
                  >
                    <PickIcon className="size-3.5" />
                    {pickLabel}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
