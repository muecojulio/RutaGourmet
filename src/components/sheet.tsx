import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useReducedMotion } from "@/lib/hooks";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

const CLOSE_DRAG_PX = 120;

/**
 * Bottom sheet on a phone, centred dialog on a laptop. Used by the start point
 * and "add place" flows, both of which open over the map without losing it.
 *
 * The grab handle drags the sheet down to dismiss (native app feel): the drag
 * is capped, only vertical, and disabled under reduced motion — the close
 * button and Escape always remain the explicit paths.
 */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  const reducedMotion = useReducedMotion();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; y: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (reducedMotion || event.pointerType === "mouse") return;
    drag.current = { pointerId: event.pointerId, y: event.clientY };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const dy = event.clientY - state.y;
    if (dy > 0) setDragY(Math.min(CLOSE_DRAG_PX + 40, dy));
  };

  const finish = (event: ReactPointerEvent) => {
    const state = drag.current;
    drag.current = null;
    setDragging(false);
    if (!state || event.pointerId !== state.pointerId) return;
    if (dragY >= CLOSE_DRAG_PX) onOpenChange(false);
    setDragY(0);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          style={
            dragging && dragY > 0
              ? { transform: `translateY(${dragY}px)`, transition: "none" }
              : undefined
          }
          className="rise fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] border border-line bg-surface p-4 pb-6 shadow-2xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[80dvh] md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
        >
          {/* Grab handle — drag down to close (touch only). */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
            data-no-swipe
            className="mx-auto mb-1 flex h-8 w-full touch-pan-y items-center justify-center md:hidden"
            aria-hidden="true"
          >
            <span className="h-1.5 w-12 rounded-full bg-line" />
          </div>
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
              className="press grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
