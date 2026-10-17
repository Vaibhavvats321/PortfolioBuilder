import { describe, expect, it } from "vitest";

import { defaultForField, defaultsForFields } from "@/lib/section/defaults";
import type { SectionField } from "@/types/section";

function makeField(partial: Partial<SectionField>): SectionField {
  return {
    name: "field",
    kind: "text",
    label: "Field",
    required: false,
    max_length: null,
    options: [],
    default: null,
    placeholder: null,
    help_text: null,
    item_label: null,
    max_items: 50,
    fields: [],
    ...partial,
  };
}

describe("defaultForField", () => {
  it("defaults repeaters to an empty list", () => {
    expect(defaultForField(makeField({ kind: "repeater" }))).toEqual([]);
  });

  it("defaults booleans to false when unset", () => {
    expect(defaultForField(makeField({ kind: "boolean" }))).toBe(false);
    expect(defaultForField(makeField({ kind: "boolean", default: true }))).toBe(
      true,
    );
  });

  it("defaults selects to the declared default or first option", () => {
    const withDefault = makeField({
      kind: "select",
      options: ["left", "center"],
      default: "center",
    });
    expect(defaultForField(withDefault)).toBe("center");

    const withoutDefault = makeField({
      kind: "select",
      options: ["line", "space"],
    });
    expect(defaultForField(withoutDefault)).toBe("line");
  });

  it("defaults text-like fields to their string default or empty string", () => {
    expect(defaultForField(makeField({ kind: "text" }))).toBe("");
    expect(
      defaultForField(makeField({ kind: "url", default: "https://x.com" })),
    ).toBe("https://x.com");
  });
});

describe("defaultsForFields", () => {
  it("builds a mapping for all fields", () => {
    const fields = [
      makeField({ name: "heading" }),
      makeField({ name: "show", kind: "boolean" }),
    ];
    expect(defaultsForFields(fields)).toEqual({ heading: "", show: false });
  });
});
