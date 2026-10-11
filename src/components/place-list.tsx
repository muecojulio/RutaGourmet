import { useMemo, useState, type ReactNode } from "react";
import { Heart, Navigation, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { categoryEmoji } from "@/lib/category-emoji";
import { crowFlies, formatDistance } from "@/lib/format";
import type { Place } from "@/lib/places-store";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Chip, ChipLane, StatChip } from "@/components/ui/chip-lane";
import { Combobox } from "@/components/ui/combobox";
import { SwipeCard, type SwipeAction } from "@/components/ui/swipe-card";

type OriginPoint = { lat: number; lon: number };

/** Heart toggle with a one-shot burst when it turns on. */
function FavoriteButton({
  active,
  onToggle,
  size = "md",
}: {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  const [burstKey, setBurstKey] = useState(0);
  return (
    <button
      type="button"
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={active}
      onClick={() => {
        if (!active) setBurstKey((n) => n + 1);
        onToggle();
      }}
      className={cn(
        "press grid shrink-0 place-items-center rounded-full border",
        size === "md" ? "size-11" : "size-10",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-line text-muted hover:border-primary/40 hover:text-fg",
      )}
    >
      <Heart
        key={burstKey}
        className={cn("size-5", active && "fill-current burst")}
        aria-hidden="true"
      />
    </button>
  );
}

/** The full card for one saved place — body + swipe-revealed actions. */
function PlaceCardItem({
  place,
  origin,
  onOpen,
  onFavorite,
  onRemove,
}: {
  place: Place;
  origin: OriginPoint | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const actions: SwipeAction[] = [
    {
      id: "fav",
      label: place.favorite ? "Quitar ♥" : "Favorito",
      icon: <Heart className={cn("size-4", place.favorite && "fill-current")} aria-hidden="true" />,
      tone: "primary",
      onClick: () => onFavorite(place.id),
    },
    {
      id: "remove",
      label: "Quitar",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      tone: "danger",
      onClick: () => {
        onRemove(place.id);
        toast.success("Lugar quitado");
      },
    },
  ];

  return (
    <SwipeCard
      actions={actions}
      aria-label={`${place.name}. Desliza o usa el menú para acciones.`}
      className="rise"
    >
      <div className="flex items-start gap-3 pr-9">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-lg"
        >
          {categoryEmoji(place.category)}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(place.id)}
            className="block w-full text-left"
            data-testid={`lugar-${place.id}`}
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{place.name}</span>
              {place.favorite ? (
                <Star
                  className="size-3.5 shrink-0 fill-saffron text-saffron"
                  aria-label="Favorito"
                />
              ) : null}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span>{place.category}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold",
                  place.visited ? "bg-good/15 text-good" : "bg-surface-2 text-muted",
                )}
              >
                {place.visited ? "Visitado" : "Por visitar"}
              </span>
              {origin ? <span>{formatDistance(crowFlies(origin, place))}</span> : null}
            </span>
          </button>
          {place.note ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted">“{place.note}”</p>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1 text-primary hover:text-primary"
            leading={<Navigation className="size-4" aria-hidden="true" />}
            onClick={() => onOpen(place.id)}
          >
            Cómo llegar
          </Button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <FavoriteButton active={place.favorite} onToggle={() => onFavorite(place.id)} />
        </div>
      </div>
    </SwipeCard>
  );
}

/**
 * The saved-places list with filter chips (horizontal lane), a jump-to
 * combobox, stat chips, and staggered card entrance. Shared by the “Lugares”
 * and “Favoritos” tabs.
 */
export function PlaceList({
  headingId,
  title,
  icon,
  intro,
  empty,
  items,
  origin,
  onOpen,
  onFavorite,
  onRemove,
  onAdd,
  showFilters = false,
}: {
  headingId?: string;
  title: string;
  icon?: ReactNode;
  intro: string;
  empty: string;
  items: Place[];
  origin: OriginPoint | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd?: () => void;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState<"todos" | "pendientes" | "visitados">("todos");
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (!showFilters || filter === "todos") return true;
        if (filter === "visitados") return item.visited;
        return !item.visited;
      }),
    [items, showFilters, filter],
  );
  const stats = useMemo(
    () => ({
      total: items.length,
      favorites: items.filter((item) => item.favorite).length,
      visited: items.filter((item) => item.visited).length,
    }),
    [items],
  );

  return (
    <div className="rise">
      <h1 id={headingId} className="flex items-center gap-2 font-display text-3xl leading-none">
        {icon}
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted">{intro}</p>

      {onAdd ? (
        <Button
          size="lg"
          className="mt-4 w-full"
          leading={<Plus className="size-4" />}
          onClick={onAdd}
        >
          Agregar lugar
        </Button>
      ) : null}

      {items.length > 0 ? (
        <ChipLane label="Resumen de tus lugares" className="mt-4">
          <StatChip label="guardados" value={stats.total} />
          <StatChip label="favoritos" value={stats.favorites} tone="primary" />
          <StatChip label="visitados" value={stats.visited} tone="good" />
        </ChipLane>
      ) : null}

      {items.length >= 4 ? (
        <div className="mt-3">
          <Combobox
            label="Ir a un lugar guardado"
            placeholder="Escribe para filtrar tus lugares…"
            emptyMessage="Ningún lugar coincide"
            groupLabel="Tus lugares"
            options={items.map((item) => ({
              id: item.id,
              label: item.name,
              hint: `${item.category}${origin ? ` · ${formatDistance(crowFlies(origin, item))}` : ""}`,
              adornment: categoryEmoji(item.category),
            }))}
            onConfirm={(option) => {
              onOpen(option.id);
              toast.success(`Yendo a ${option.label}`);
            }}
          />
        </div>
      ) : null}

      {showFilters ? (
        <ChipLane label="Filtros" className="mt-4">
          {(
            [
              ["todos", "Todos", "🔖"],
              ["pendientes", "Por visitar", "📍"],
              ["visitados", "Visitados", "✅"],
            ] as const
          ).map(([id, label, emoji]) => (
            <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>
              <span aria-hidden="true">{emoji}</span>
              {label}
            </Chip>
          ))}
        </ChipLane>
      ) : null}

      {visible.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-surface/60 px-4 py-10 text-center">
          <span aria-hidden="true" className="text-3xl">
            {items.length === 0 ? "🍧" : "🔍"}
          </span>
          <p className="mt-3 text-sm text-muted">
            {items.length === 0 ? empty : "Nada con ese filtro."}
          </p>
          {items.length === 0 && onAdd ? (
            <Button variant="surface" size="sm" className="mt-4" onClick={onAdd}>
              Agregar el primero
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="stagger mt-4 space-y-3">
          {visible.map((item, index) => (
            <li key={item.id} style={{ ["--stagger-i" as string]: index }}>
              <PlaceCardItem
                place={item}
                origin={origin}
                onOpen={onOpen}
                onFavorite={onFavorite}
                onRemove={onRemove}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Favoritos tab: when there is something to compare, a carousel of highlight
 * cards first (peeking next card suggests more), then the full list.
 */
export function FavoritesView({
  headingId,
  places,
  origin,
  onOpen,
  onFavorite,
  onRemove,
}: {
  headingId?: string;
  places: Place[];
  origin: OriginPoint | null;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const favorites = places.filter((item) => item.favorite);
  const visitedCount = places.filter((item) => item.visited).length;

  return (
    <>
      <PlaceList
        headingId={headingId}
        title="Favoritos"
        icon={<Heart className="size-7 fill-primary text-primary" aria-hidden="true" />}
        intro={
          places.length === 0
            ? "Los lugares que te gustaron se quedan en este teléfono."
            : `${favorites.length} de ${places.length} lugares, y ${visitedCount} ya visitados.`
        }
        empty="Todavía no hay favoritos. Abre un lugar en el mapa y enciende el interruptor, o toca el corazón de la lista."
        items={favorites}
        origin={origin}
        onOpen={onOpen}
        onFavorite={onFavorite}
        onRemove={onRemove}
      />

      {favorites.length >= 2 ? (
        <section className="mt-8">
          <h2 className="rule-label">Tus joyas</h2>
          <p className="mt-2 text-xs text-muted">
            Tus favoritos de un vistazo — desliza para comparar.
          </p>
          <Carousel label="Favoritos destacados" className="mt-3">
            {favorites.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                className="lift card group relative block h-full w-full overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4 text-left shadow-[var(--shadow-card)]"
                data-testid={`joya-${item.id}`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-6 -right-6 size-20 rounded-full bg-primary/10 blur-xl"
                />
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-2xl">
                    {categoryEmoji(item.category)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{item.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {item.category}
                      {origin ? ` · ${formatDistance(crowFlies(origin, item))}` : ""}
                    </span>
                  </span>
                </span>
                {item.note ? (
                  <span className="mt-2 block line-clamp-2 text-xs text-muted">“{item.note}”</span>
                ) : (
                  <span className="mt-2 flex items-center gap-1 text-xs text-primary">
                    <Sparkles className="size-3" aria-hidden="true" /> ¿Cómo estuvo? Déjale una nota
                  </span>
                )}
                <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                  <Navigation className="size-3.5" aria-hidden="true" /> Ver ruta
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </button>
            ))}
          </Carousel>
        </section>
      ) : null}

      <VisitedSuggestions places={places} onOpen={onOpen} onFavorite={onFavorite} />
    </>
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
    <section className="mt-8">
      <h2 className="rule-label">Visitados que te pueden gustar</h2>
      <p className="mt-2 text-xs text-muted">
        Ya fuiste. Si te gustaron, agrégalos a favoritos para tenerlos a mano.
      </p>
      <ul className="stagger mt-3 space-y-2">
        {pending.map((item, index) => (
          <li
            key={item.id}
            className="lift flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            style={{ ["--stagger-i" as string]: index }}
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2"
            >
              {categoryEmoji(item.category)}
            </span>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted">{item.category} · Visitado</span>
            </button>
            <Button
              size="sm"
              leading={<Heart className="size-4" aria-hidden="true" />}
              onClick={() => onFavorite(item.id)}
            >
              Favorito
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
