import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TravelMode = "foot" | "driving" | "bike";
export type AppTab = "mapa" | "lugares" | "favoritos" | "qr" | "privacidad";

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string;
  favorite: boolean;
  visited: boolean;
  note: string;
  addedAt: number;
};

export type Origin = {
  lat: number;
  lon: number;
  label: string;
  isDevice: boolean;
};

type State = {
  places: Place[];
  origin: Origin | null;
  activeId: string | null;
  mode: TravelMode;
  theme: "dark" | "light";
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  setMode: (mode: TravelMode) => void;
  setTheme: (theme: "dark" | "light") => void;
  setOrigin: (origin: Origin) => void;
  setActive: (id: string | null) => void;
  savePlace: (input: Omit<Place, "favorite" | "visited" | "note" | "addedAt" | "id"> & { id?: string }) => string;
  toggleFavorite: (id: string) => void;
  toggleVisited: (id: string) => void;
  setNote: (id: string, note: string) => void;
  removePlace: (id: string) => void;
  clearAll: () => void;
};

function sameSpot(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return Math.abs(a.lat - b.lat) < 0.00025 && Math.abs(a.lon - b.lon) < 0.00025;
}

export const usePlaces = create<State>()(
  persist(
    (set, get) => ({
      places: [],
      origin: null,
      activeId: null,
      mode: "foot",
      theme: "dark",
      tab: "mapa",
      setTab: (tab) => set({ tab }),
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setOrigin: (origin) => set({ origin }),
      setActive: (id) => set({ activeId: id, tab: id ? "mapa" : get().tab }),
      savePlace: (input) => {
        const existing = get().places.find(
          (place) => place.id === input.id || sameSpot(place, input),
        );
        if (existing) {
          set({ activeId: existing.id, tab: "mapa" });
          return existing.id;
        }
        const id = input.id ?? crypto.randomUUID();
        const place: Place = {
          id,
          name: input.name.trim() || "Lugar sin nombre",
          address: input.address.trim(),
          lat: input.lat,
          lon: input.lon,
          category: input.category || "Lugar",
          favorite: false,
          visited: false,
          note: "",
          addedAt: Date.now(),
        };
        set({ places: [place, ...get().places], activeId: id, tab: "mapa" });
        return id;
      },
      toggleFavorite: (id) =>
        set({
          places: get().places.map((place) =>
            place.id === id ? { ...place, favorite: !place.favorite } : place,
          ),
        }),
      toggleVisited: (id) =>
        set({
          places: get().places.map((place) =>
            place.id === id ? { ...place, visited: !place.visited } : place,
          ),
        }),
      setNote: (id, note) =>
        set({
          places: get().places.map((place) =>
            place.id === id ? { ...place, note: note.slice(0, 280) } : place,
          ),
        }),
      removePlace: (id) =>
        set({
          places: get().places.filter((place) => place.id !== id),
          activeId: get().activeId === id ? null : get().activeId,
        }),
      clearAll: () => set({ places: [], activeId: null }),
    }),
    {
      name: "rutagourmet-v1",
      skipHydration: true,
      partialize: (state) => ({
        places: state.places,
        origin: state.origin,
        activeId: state.activeId,
        mode: state.mode,
        theme: state.theme,
      }),
    },
  ),
);

export function activePlace(places: Place[], activeId: string | null) {
  return places.find((place) => place.id === activeId) ?? null;
}
