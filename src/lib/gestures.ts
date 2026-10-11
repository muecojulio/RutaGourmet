/**
 * Pure gesture classification shared by the swipe systems (panel swipe,
 * swipe-to-reveal). Kept free of DOM so the thresholds are unit-testable.
 *
 * Reference rule from the interaction spec: a gesture is *horizontal* when the
 * lateral displacement clearly beats the vertical one (~1.2× ratio) AND has
 * enough distance or speed to be intentional.
 */

/** Horizontal must dominate vertical by at least this ratio. */
export const AXIS_RATIO = 1.2;

/** Minimum distance (px) before a gesture counts at all. */
export const MIN_DISTANCE_PX = 24;

/** Minimum speed (px/ms) that turns a short drag into an intentional flick. */
export const FLICK_SPEED_PX_MS = 0.5;

export type GestureVerdict = "horizontal" | "vertical" | "ambiguous";

/**
 * Classify a drag from its totals. Distance wins over speed here: this decides
 * the *axis lock*, not the final open/close decision.
 */
export function classifyAxis(
  dx: number,
  dy: number,
  minDistancePx = MIN_DISTANCE_PX,
): GestureVerdict {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < minDistancePx && ady < minDistancePx) return "ambiguous";
  if (adx > ady * AXIS_RATIO) return "horizontal";
  if (ady > adx * AXIS_RATIO) return "vertical";
  return "ambiguous";
}

/**
 * Should a horizontal drag *commit*? True with enough travel, or a quick flick
 * even when the travel is short (the familiar card-swipe feel).
 */
export function shouldCommitSwipe(
  distancePx: number,
  speedPxPerMs: number,
  thresholdPx: number,
): boolean {
  return Math.abs(distancePx) >= thresholdPx || Math.abs(speedPxPerMs) >= FLICK_SPEED_PX_MS;
}

/**
 * Direction sign for a committed horizontal gesture: -1 → to the left,
 * +1 → to the right. Small movements resolve by direction; flicks too.
 */
export function swipeDirection(dx: number, speedDx: number): -1 | 0 | 1 {
  const bias = Math.abs(speedDx) >= FLICK_SPEED_PX_MS ? Math.sign(speedDx) : 0;
  const base = Math.abs(dx) >= MIN_DISTANCE_PX ? Math.sign(dx) : 0;
  const value = bias !== 0 ? bias : base;
  return value === 0 ? 0 : value > 0 ? 1 : -1;
}
