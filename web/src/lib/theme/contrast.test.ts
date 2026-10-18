import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  hexToRgb,
  meetsWcagAA,
  relativeLuminance,
} from "@/lib/theme/contrast";

describe("hexToRgb", () => {
  it("parses shorthand and full hex colors", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#1a2b3c")).toEqual({ r: 26, g: 43, b: 60 });
  });

  it("returns null for invalid input", () => {
    expect(hexToRgb("red")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
    expect(hexToRgb("#12345g")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("returns the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of order", () => {
    const a = contrastRatio("#0f172a", "#f8fafc");
    const b = contrastRatio("#f8fafc", "#0f172a");
    expect(a).not.toBeNull();
    expect(a).toBeCloseTo(b ?? 0, 10);
  });

  it("returns null when a color is invalid", () => {
    expect(contrastRatio("nope", "#ffffff")).toBeNull();
    expect(contrastRatio("#ffffff", "#12345")).toBeNull();
  });
});

describe("meetsWcagAA", () => {
  it("requires 4.5:1 for normal text and 3:1 for large text", () => {
    expect(meetsWcagAA(4.5)).toBe(true);
    expect(meetsWcagAA(4.4)).toBe(false);
    expect(meetsWcagAA(3, true)).toBe(true);
    expect(meetsWcagAA(2.9, true)).toBe(false);
  });
});
