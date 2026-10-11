/**
 * Math that keeps a route inside the strip of map the floating panels leave
 * free.
 *
 * The Mapa tab paints its search panel over the top of the map and, when a
 * place is open, its detail card over the bottom. Leaflet centres fitted bounds
 * in the *whole* container, so with a tall card open the starting point ended up
 * underneath the card (and, on phones, off screen). These helpers are pure so
 * the clamping rules stay testable without a browser.
 */

export type MapInsets = { top: number; bottom: number; right: number };
/** The part of `MapInsets` the vertical clamp works on. */
export type VerticalInsets = { top: number; bottom: number };
export type MapSize = { width: number; height: number };

/** `fitBounds` options that push Leaflet content away from the covered edges. */
export type FitPadding = {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
};

/** Smallest strip of map we refuse to give up, in px. */
export const MIN_VISIBLE_BAND = 150;

/** Breathing room between the fitted content and the panels, in px. */
export const FIT_MARGIN = 16;

/**
 * Keeps `top + bottom` small enough to leave `minBand` px of usable map. When
 * the panels are taller than that (short phones), both insets shrink by the
 * same factor so their proportion — and the map's centre — stay put.
 */
export function clampInsets(
  size: MapSize,
  insets: VerticalInsets,
  minBand = MIN_VISIBLE_BAND,
): VerticalInsets {
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;
  const top = Number.isFinite(insets.top) ? Math.max(0, insets.top) : 0;
  const bottom = Number.isFinite(insets.bottom) ? Math.max(0, insets.bottom) : 0;
  const room = height - minBand;
  const total = top + bottom;
  if (total <= room) return { top, bottom };
  if (room <= 0 || total <= 0) return { top: 0, bottom: 0 };
  const scale = room / total;
  return { top: Math.round(top * scale), bottom: Math.round(bottom * scale) };
}

/**
 * How much of the right edge the floating buttons may claim: enough for the
 * widest control, never more than a third of the map. A wider strip would push
 * the fitted route into a sliver on phones.
 */
export function clampRight(size: MapSize, right: number): number {
  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const value = Number.isFinite(right) ? Math.max(0, right) : 0;
  return Math.min(value, Math.round(width / 3));
}

/**
 * Leaflet `fitBounds` options for the visible strip. Passing `maxZoom` matters:
 * with a single point (degenerate bounds) Leaflet bails out of `fitBounds`
 * unless a finite max zoom is given, and only then does it honour the padding
 * offset that several of these panels need.
 */
export function fitPadding(
  size: MapSize,
  insets: MapInsets,
  margin = FIT_MARGIN,
  minBand = MIN_VISIBLE_BAND,
): FitPadding {
  const clamped = clampInsets(size, insets, minBand);
  const right = clampRight(size, insets.right ?? 0);
  return {
    paddingTopLeft: [margin, clamped.top + margin],
    // Leaflet pads the bottom-right corner: the buttons on that edge and the
    // card at the bottom share it, so the wider of the two decides.
    paddingBottomRight: [Math.max(margin, right + margin), clamped.bottom + margin],
  };
}
