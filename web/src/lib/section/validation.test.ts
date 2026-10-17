import { describe, expect, it } from "vitest";

import {
  validateFieldValue,
  validateSectionFields,
} from "@/lib/section/validation";

describe("validateFieldValue", () => {
  it("reports a required text field that is blank", () => {
    const field = {
      name: "heading",
      kind: "text" as const,
      label: "Heading",
      required: true,
      max_length: 500,
      options: [],
      default: null,
      placeholder: null,
      help_text: null,
      item_label: null,
      max_items: 50,
      fields: [],
    };
    expect(validateFieldValue(field, "   ")).toBe("Heading is required.");
    expect(validateFieldValue(field, "Hi")).toBeUndefined();
  });

  it("enforces text length", () => {
    const field = {
      name: "heading",
      kind: "text" as const,
      label: "Heading",
      required: false,
      max_length: 3,
      options: [],
      default: null,
      placeholder: null,
      help_text: null,
      item_label: null,
      max_items: 50,
      fields: [],
    };
    expect(validateFieldValue(field, "abcd")).toBe(
      "Heading must be at most 3 characters.",
    );
  });

  it("validates optional and required URLs", () => {
    const optional = {
      name: "image_url",
      kind: "url" as const,
      label: "Image URL",
      required: false,
      max_length: 2048,
      options: [],
      default: null,
      placeholder: null,
      help_text: null,
      item_label: null,
      max_items: 50,
      fields: [],
    };
    expect(validateFieldValue(optional, "")).toBeUndefined();
    expect(validateFieldValue(optional, "not a url")).toBe(
      "Enter a valid http or https URL.",
    );
    expect(
      validateFieldValue(optional, "https://example.com/a.png"),
    ).toBeUndefined();
    expect(validateFieldValue(optional, "javascript:alert(1)")).toBe(
      "Enter a valid http or https URL.",
    );

    const required = {
      ...optional,
      name: "link",
      label: "Link",
      required: true,
    };
    expect(validateFieldValue(required, "  ")).toBe("Link is required.");
  });

  it("validates selects and booleans", () => {
    const select = {
      name: "style",
      kind: "select" as const,
      label: "Style",
      required: false,
      max_length: null,
      options: ["line", "space"],
      default: "line",
      placeholder: null,
      help_text: null,
      item_label: null,
      max_items: 50,
      fields: [],
    };
    expect(validateFieldValue(select, "line")).toBeUndefined();
    expect(validateFieldValue(select, "dashed")).toContain("must be one of");

    const boolean = { ...select, kind: "boolean" as const, label: "Show" };
    expect(validateFieldValue(boolean, true)).toBeUndefined();
    expect(validateFieldValue(boolean, "yes")).toBe(
      "Show must be true or false.",
    );
  });
});

describe("validateSectionFields", () => {
  const repeater = {
    name: "buttons",
    kind: "repeater" as const,
    label: "Buttons",
    required: false,
    max_length: null,
    options: [],
    default: null,
    placeholder: null,
    help_text: null,
    item_label: "Button",
    max_items: 2,
    fields: [
      {
        name: "label",
        kind: "text" as const,
        label: "Label",
        required: false,
        max_length: 80,
        options: [],
        default: null,
        placeholder: null,
        help_text: null,
        item_label: null,
        max_items: 50,
        fields: [],
      },
      {
        name: "url",
        kind: "url" as const,
        label: "URL",
        required: false,
        max_length: 2048,
        options: [],
        default: null,
        placeholder: null,
        help_text: null,
        item_label: null,
        max_items: 50,
        fields: [],
      },
    ],
  };

  it("reports nested repeater item errors by path", () => {
    const errors = validateSectionFields([repeater], {
      buttons: [
        { label: "Ok", url: "https://example.com" },
        { label: "Bad", url: "nope" },
      ],
    });
    expect(errors).toEqual({
      "buttons.1.url": "Enter a valid http or https URL.",
    });
  });

  it("enforces the repeater item cap", () => {
    const errors = validateSectionFields([repeater], {
      buttons: [{}, {}, {}],
    });
    expect(errors["buttons"]).toBe("Buttons must contain at most 2 items.");
  });

  it("rejects non-list repeater values", () => {
    const errors = validateSectionFields([repeater], { buttons: "nope" });
    expect(errors["buttons"]).toBe("Buttons must be a list.");
  });
});
