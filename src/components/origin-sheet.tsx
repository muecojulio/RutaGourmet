import { LocateFixed } from "lucide-react";
import { PlaceFinder } from "@/components/place-finder";
import { Sheet } from "@/components/sheet";
import type { GeoHit } from "@/lib/geo";
import { usePlaces } from "@/lib/places-store";

type OriginSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locating: boolean;
  onUseDevice: () => void;
  onPick: (hit: GeoHit) => void;
  note?: string | null;
};

/**
 * The start point lives on the map now: one button over the map opens this
 * sheet, where the phone's own fix and any searched address are one tap apart.
 */
export function OriginSheet({
  open,
  onOpenChange,
  locating,
  onUseDevice,
  onPick,
  note,
}: OriginSheetProps) {
  const origin = usePlaces((s) => s.origin);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Punto de partida"
      description="De aquí salen todas tus rutas. Usa tu ubicación o busca una dirección."
    >
      <section className="rounded-3xl border border-line bg-bg p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          <span className="pin-origin" aria-hidden="true" />
          Partida actual
        </div>
        <p className="mt-2 truncate font-medium">{origin?.label ?? "Todavía sin definir"}</p>
        {origin ? (
          <p className="mt-0.5 text-xs text-muted">
            {origin.isDevice
              ? "Tomada de la ubicación de este dispositivo"
              : `${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onUseDevice}
          disabled={locating}
          className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          <LocateFixed className="size-4" />
          {locating ? "Buscando tu ubicación…" : "Usar mi ubicación"}
        </button>
        {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
      </section>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">O busca desde dónde sales</p>
        <PlaceFinder
          idPrefix="partida"
          onPick={onPick}
          pickLabel="Usar como partida"
          variant="card"
          placeholder="Barrio, calle o restaurante"
        />
      </div>
    </Sheet>
  );
}
