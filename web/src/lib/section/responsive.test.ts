import { describe, expect, it } from "vitest";

import {
  DEFAULT_BREAKPOINT,
  RESPONSIVE_BREAKPOINTS,
  defaultResponsiveOverrides,
  normalizeResponsiveOverrides,
  resolveSectionStyle,
} from "@/lib/section/responsive";
import type { SectionStyle } from "@/types/section";

describe("breakpoint constants", () => {
  it("mirrors the backend breakpoint identifiers in a stable order", () => {
    expect(RESPONSIVE_BREAKPOINTS).toEqual(["desktop", "tablet", "mobile"]);
    expect(DEFAULT_BREAKPOINT).toBe("desktop");
  });
});

describe("defaultResponsiveOverrides", () => {
  it("maps every breakpoint to inherit", () => {
    expect(defaultResponsiveOverrides()).toEqual({
      desktop: null,
      tablet: null,
      mobile: null,
    });
  });
});

describe("normalizeResponsiveOverrides", () => {
  it("returns all-inherit for non-object values", () => {
    const expected = defaultResponsiveOverrides();
    expect(normalizeResponsiveOverrides(null)).toEqual(expected);
    expect(normalizeResponsiveOverrides(undefined)).toEqual(expected);
    expect(normalizeResponsiveOverrides("junk")).toEqual(expected);
    expect(normalizeResponsiveOverrides([1, 2])).toEqual(expected);
    expect(normalizeResponsiveOverrides(42)).toEqual(expected);
  });

  it("fills missing breakpoints with inherit", () => {
    expect(
      normalizeResponsiveOverrides({ mobile: { spacing: "large" } }),
    ).toEqual({
      desktop: null,
      tablet: null,
      mobile: { spacing: "large" },
    });
  });

  it("drops unknown breakpoints and non-object entries", () => {
    expect(
      normalizeResponsiveOverrides({
        desktop: null,
        wide: { spacing: "small" },
        tablet: "nope",
        mobile: { spacing: "medium" },
      }),
    ).toEqual({
      desktop: null,
      tablet: null,
      mobile: { spacing: "medium" },
    });
  });
});

describe("resolveSectionStyle", () => {
  const base: SectionStyle = {
    background: "custom",
    background_color: "#101010",
    spacing: "medium",
    responsive_override: {
      desktop: null,
      tablet: { spacing: "large" },
      mobile: { spacing: "none", width: "full" },
    },
  };

  it("returns an empty style when nothing is stored", () => {
    expect(resolveSectionStyle(undefined, "desktop")).toEqual({});
    expect(resolveSectionStyle({}, "mobile")).toEqual({});
  });

  it("returns a copy of the base style when the breakpoint inherits", () => {
    const resolved = resolveSectionStyle(base, "desktop");
    expect(resolved).toEqual(base);
    expect(resolved).not.toBe(base);
  });

  it("layers the breakpoint override over the base style", () => {
    expect(resolveSectionStyle(base, "tablet")).toEqual({
      ...base,
      spacing: "large",
    });
    expect(resolveSectionStyle(base, "mobile")).toEqual({
      ...base,
      spacing: "none",
      width: "full",
    });
  });

  it("keeps working when responsive_override itself is missing", () => {
    const style: SectionStyle = { spacing: "small" };
    expect(resolveSectionStyle(style, "mobile")).toEqual(style);
  });

  it("never mutates the stored style", () => {
    const before = JSON.stringify(base);
    resolveSectionStyle(base, "desktop");
    resolveSectionStyle(base, "tablet");
    resolveSectionStyle(base, "mobile");
    expect(JSON.stringify(base)).toBe(before);
    expect(base.responsive_override).toEqual({
      desktop: null,
      tablet: { spacing: "large" },
      mobile: { spacing: "none", width: "full" },
    });
  });
});
