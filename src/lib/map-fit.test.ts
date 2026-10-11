import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampInsets, clampRight, fitPadding, FIT_MARGIN, MIN_VISIBLE_BAND } from "./map-fit.ts";

describe("clampInsets", () => {
  it("keeps the measured panels when a visible band still fits", () => {
    assert.deepEqual(clampInsets({ width: 390, height: 712 }, { top: 130, bottom: 268 }), {
      top: 130,
      bottom: 268,
    });
  });

  it("shrinks both panels proportionally on a short screen", () => {
    const clamped = clampInsets({ width: 320, height: 348 }, { top: 130, bottom: 268 });
    assert.deepEqual(clamped, { top: 65, bottom: 133 });
    assert.ok(clamped.top + clamped.bottom <= 348 - MIN_VISIBLE_BAND + 1);
  });

  it("drops the insets when even the minimum band does not fit", () => {
    assert.deepEqual(clampInsets({ width: 320, height: 120 }, { top: 90, bottom: 90 }), {
      top: 0,
      bottom: 0,
    });
  });

  it("ignores negative and non-finite input", () => {
    assert.deepEqual(
      clampInsets({ width: 390, height: Number.NaN }, { top: -20, bottom: Number.NaN }),
      { top: 0, bottom: 0 },
    );
  });
});

describe("clampRight", () => {
  it("keeps a strip that fits inside a third of the map", () => {
    assert.equal(clampRight({ width: 1280, height: 700 }, 190), 190);
  });

  it("caps the strip on a phone so the route does not get squeezed", () => {
    assert.equal(clampRight({ width: 390, height: 700 }, 190), 130);
  });

  it("ignores negative and non-finite input", () => {
    assert.equal(clampRight({ width: 390, height: 700 }, Number.NaN), 0);
    assert.equal(clampRight({ width: 390, height: 700 }, -40), 0);
  });
});

describe("fitPadding", () => {
  it("offsets the bottom padding so the start point clears the detail card", () => {
    const padding = fitPadding({ width: 390, height: 712 }, { top: 130, bottom: 268, right: 0 });
    assert.deepEqual(padding.paddingTopLeft, [FIT_MARGIN, 146]);
    assert.deepEqual(padding.paddingBottomRight, [FIT_MARGIN, 284]);
  });

  it("falls back to the plain margin when nothing covers the map", () => {
    const padding = fitPadding({ width: 390, height: 712 }, { top: 0, bottom: 0, right: 0 });
    assert.deepEqual(padding.paddingTopLeft, [FIT_MARGIN, FIT_MARGIN]);
    assert.deepEqual(padding.paddingBottomRight, [FIT_MARGIN, FIT_MARGIN]);
  });

  it("pushes the fit away from the floating buttons on the right edge", () => {
    const padding = fitPadding(
      { width: 1280, height: 700 },
      { top: 165, bottom: 300, right: 190 },
    );
    assert.deepEqual(padding.paddingBottomRight, [206, 316]);
  });

  it("never asks Leaflet to pad more than the container is tall", () => {
    const padding = fitPadding({ width: 320, height: 348 }, { top: 130, bottom: 268, right: 90 });
    assert.ok(padding.paddingTopLeft[1] + padding.paddingBottomRight[1] < 348);
    assert.ok(padding.paddingTopLeft[0] + padding.paddingBottomRight[0] < 320);
  });
});
