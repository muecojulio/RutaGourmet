import { Lightbulb } from "lucide-react";
import { PlaceFinder } from "@/components/place-finder";
import { Sheet } from "@/components/sheet";
import type { GeoHit } from "@/lib/geo";

type AddPlaceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Save the place without leaving the sheet, so several can be queued up. */
  onSave: (hit: GeoHit) => void;
  /** Save it, close the sheet and draw the route from the start point. */
  onRoute: (hit: GeoHit) => void;
  onOrigin: (hit: GeoHit) => void;
};

export function AddPlaceSheet({
  open,
  onOpenChange,
  onSave,
  onRoute,
  onOrigin,
}: AddPlaceSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar lugar"
      description="Busca el restaurante al que quieres ir, o toca Cerca para ver qué hay alrededor de tu punto de partida."
    >
      <PlaceFinder
        idPrefix="agregar"
        autoFocus
        showNearby
        onSave={onSave}
        onPick={(hit) => {
          onRoute(hit);
          onOpenChange(false);
        }}
        pickLabel="Cómo llegar"
        onOrigin={(hit) => {
          onOrigin(hit);
          onOpenChange(false);
        }}
        placeholder="Tacos, café, mercado…"
      />
      <p className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-bg px-3 py-2 text-xs text-muted">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <span>
          Guardar deja el lugar en tus Lugares sin cerrar esta ventana; Cómo llegar lo guarda y te
          traza la ruta desde el punto de partida.
        </span>
      </p>
    </Sheet>
  );
}
