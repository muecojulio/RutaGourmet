import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Bottom sheet on a phone, centred dialog on a laptop. Used by the start point
 * and "add place" flows, both of which open over the map without losing it.
 */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="rise fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl border border-line bg-surface p-4 shadow-2xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[80dvh] md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-2xl leading-none">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 text-sm text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="press grid size-10 shrink-0 place-items-center rounded-full text-muted"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
