// @vitest-environment jsdom
import type { ComponentProps } from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { SectionInspector } from "@/components/builder/section-inspector";
import { listMedia } from "@/lib/api/media";
import type { MediaAsset } from "@/types/media";
import type { PageSection, SectionField, SectionType } from "@/types/section";

vi.mock("@/lib/api/media", () => ({
  listMedia: vi.fn(),
  uploadMedia: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
  mediaFileUrl: (id: string) => `http://api.test/media/${id}/file`,
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function makeField(
  partial: Partial<SectionField> &
    Pick<SectionField, "name" | "kind" | "label">,
): SectionField {
  return {
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

const SPACING_OPTIONS = ["inherit", "none", "small", "medium", "large"];

function styleFields(): SectionField[] {
  const spacing = makeField({
    name: "spacing",
    kind: "select",
    label: "Vertical spacing",
    options: SPACING_OPTIONS,
    default: "inherit",
  });
  const backgroundColor = makeField({
    name: "background_color",
    kind: "color",
    label: "Background color",
  });
  const responsive = makeField({
    name: "responsive_override",
    kind: "object",
    label: "Responsive Override",
    help_text: "Per-breakpoint values for desktop, tablet, mobile.",
    fields: [spacing, backgroundColor],
  });
  return [spacing, backgroundColor, responsive];
}

const IMAGE_TEXT_TYPE: SectionType = {
  type_id: "image_text",
  label: "Image and text",
  description: "",
  group: "Content",
  schema_version: 1,
  content_fields: [
    makeField({ name: "heading", kind: "text", label: "Heading" }),
    makeField({ name: "body", kind: "textarea", label: "Body" }),
    makeField({
      name: "image_url",
      kind: "url",
      label: "Image URL",
      max_length: 2048,
    }),
    makeField({
      name: "image_alt",
      kind: "text",
      label: "Image alt text",
      max_length: 200,
    }),
  ],
  layout_fields: [],
  style_fields: styleFields(),
  default_content: {},
  default_layout: {},
  default_style: {},
};

const GALLERY_TYPE: SectionType = {
  type_id: "image_gallery",
  label: "Image gallery",
  description: "",
  group: "Content",
  schema_version: 1,
  content_fields: [
    makeField({ name: "heading", kind: "text", label: "Heading" }),
    makeField({
      name: "images",
      kind: "repeater",
      label: "Images",
      item_label: "Image",
      max_items: 10,
      fields: [
        makeField({
          name: "image_url",
          kind: "url",
          label: "Image URL",
          max_length: 2048,
        }),
        makeField({
          name: "caption",
          kind: "text",
          label: "Caption",
          max_length: 200,
        }),
      ],
    }),
  ],
  layout_fields: [],
  style_fields: [],
  default_content: {},
  default_layout: {},
  default_style: {},
};

function makeSection(partial: Partial<PageSection> = {}): PageSection {
  return {
    id: "section-1",
    page_id: "page-1",
    section_type: "image_text",
    name: "Intro",
    sort_order: 0,
    is_visible: true,
    content: { heading: "Hi", body: "", image_url: "", image_alt: "" },
    layout: {},
    style: { spacing: "medium", background_color: "" },
    schema_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function makeAsset(partial: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset-1",
    portfolio_id: "portfolio-1",
    storage_key: "portfolio-1/asset-1.png",
    original_filename: "image.png",
    mime_type: "image/png",
    size_bytes: 2048,
    width: 800,
    height: 600,
    alt_text: "Chosen alt",
    caption: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function renderInspector(
  section: PageSection,
  types: SectionType[],
  onSave = vi.fn().mockResolvedValue(undefined),
) {
  const utils = render(
    <SectionInspector
      section={section}
      sectionTypes={types}
      portfolioId="portfolio-1"
      onSave={onSave}
      saving={false}
      error={null}
    />,
  );
  return { ...utils, onSave };
}

describe("SectionInspector media picking", () => {
  it("fills image URL and alt in one batch when an asset is picked", async () => {
    vi.mocked(listMedia).mockResolvedValue([makeAsset()]);
    const user = userEvent.setup();
    const { onSave } = renderInspector(makeSection(), [IMAGE_TEXT_TYPE]);

    await screen.findByLabelText("Section name");
    await user.click(screen.getByRole("button", { name: "Browse media…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Select image.png" }),
    );

    expect(screen.getByLabelText("Image URL")).toHaveValue(
      "http://api.test/media/asset-1/file",
    );
    expect(screen.getByLabelText("Image alt text")).toHaveValue("Chosen alt");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]?.content).toMatchObject({
      image_url: "http://api.test/media/asset-1/file",
      image_alt: "Chosen alt",
    });
  });

  it("keeps manual URL entry and blocks invalid URLs from saving", async () => {
    const user = userEvent.setup();
    const { onSave } = renderInspector(makeSection(), [IMAGE_TEXT_TYPE]);

    await screen.findByLabelText("Section name");
    const imageUrl = screen.getByLabelText("Image URL");
    await user.type(imageUrl, "not a url");
    expect(
      await screen.findByText("Enter a valid http or https URL."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(imageUrl);
    await user.type(imageUrl, "https://example.com/x.png");
    await waitFor(() =>
      expect(
        screen.queryByText("Enter a valid http or https URL."),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("picks an image into a repeater item without clobbering siblings", async () => {
    vi.mocked(listMedia).mockResolvedValue([makeAsset()]);
    const user = userEvent.setup();
    const section = makeSection({
      section_type: "image_gallery",
      content: {
        heading: "Gallery",
        images: [{ image_url: "", caption: "Old cap" }],
      },
    });
    const { onSave } = renderInspector(section, [GALLERY_TYPE]);

    await screen.findByLabelText("Section name");
    await user.click(screen.getByRole("button", { name: "Browse media…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Select image.png" }),
    );
    expect(screen.getByLabelText("Image URL")).toHaveValue(
      "http://api.test/media/asset-1/file",
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]?.content).toMatchObject({
      images: [
        {
          image_url: "http://api.test/media/asset-1/file",
          caption: "Old cap",
        },
      ],
    });
  });
});

describe("SectionInspector responsive overrides", () => {
  it("edits per-breakpoint overrides without touching the base style", async () => {
    const user = userEvent.setup();
    const { onSave } = renderInspector(makeSection(), [IMAGE_TEXT_TYPE]);

    const editor = await screen.findByTestId("responsive-override-editor");
    const breakpointGroup = within(editor).getByRole("group", {
      name: "Responsive breakpoint",
    });
    const desktop = within(breakpointGroup).getByRole("button", {
      name: "Desktop",
    });
    expect(desktop).toHaveAttribute("aria-pressed", "true");
    expect(
      within(editor).getByText(/base style for Desktop/),
    ).toBeInTheDocument();

    await user.click(
      within(breakpointGroup).getByRole("button", { name: "Mobile" }),
    );
    expect(
      within(editor).getByText(/base style for Mobile/),
    ).toBeInTheDocument();
    await user.click(
      within(editor).getByRole("button", { name: "Customize Mobile" }),
    );

    const spacing = within(editor).getByLabelText("Vertical spacing");
    await user.selectOptions(spacing, "large");
    expect(
      within(editor).getByText(/Custom values for Mobile/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]?.style).toMatchObject({
      spacing: "medium",
      responsive_override: {
        desktop: null,
        tablet: null,
        mobile: { spacing: "large" },
      },
    });
  });

  it("resets a breakpoint back to inherit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderInspector(makeSection(), [IMAGE_TEXT_TYPE]);

    const editor = await screen.findByTestId("responsive-override-editor");
    await user.click(within(editor).getByRole("button", { name: "Desktop" }));
    await user.click(
      within(editor).getByRole("button", { name: "Customize Desktop" }),
    );
    const spacing = within(editor).getByLabelText("Vertical spacing");
    await user.selectOptions(spacing, "small");
    await user.click(
      within(editor).getByRole("button", {
        name: "Reset Desktop to inherit",
      }),
    );
    expect(
      within(editor).getByText(/base style for Desktop/),
    ).toBeInTheDocument();

    // Only the reset itself is a net change back to the stored shape.
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]?.style).toMatchObject({
      spacing: "medium",
      responsive_override: { desktop: null, tablet: null, mobile: null },
    });
  });

  it("displays override validation errors inside the editor", async () => {
    const user = userEvent.setup();
    renderInspector(makeSection(), [IMAGE_TEXT_TYPE]);

    const editor = await screen.findByTestId("responsive-override-editor");
    await user.click(within(editor).getByRole("button", { name: "Tablet" }));
    await user.click(
      within(editor).getByRole("button", { name: "Customize Tablet" }),
    );
    const spacing = within(editor).getByLabelText("Vertical spacing");
    // The select only offers valid options, so force an invalid stored value
    // by typing into the background color text input instead.
    const color = within(editor).getByLabelText("Background color");
    await user.type(color, "nope");
    expect(await within(editor).findByText(/hex color/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(spacing).toBeInTheDocument();
  });
});

describe("SectionInspector draft-save integration", () => {
  function renderWithProps(
    props: Partial<ComponentProps<typeof SectionInspector>> = {},
    onSave = vi.fn().mockResolvedValue(true),
  ) {
    const utils = render(
      <SectionInspector
        section={makeSection()}
        sectionTypes={[IMAGE_TEXT_TYPE]}
        portfolioId="portfolio-1"
        onSave={onSave}
        saving={false}
        error={null}
        {...props}
      />,
    );
    return { ...utils, onSave };
  }

  it("reports dirty and validation state to the toolbar", async () => {
    const user = userEvent.setup();
    const onFormStateChange = vi.fn();
    renderWithProps({ onFormStateChange });

    await screen.findByLabelText("Section name");
    expect(onFormStateChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Section name"), "!");
    await waitFor(() =>
      expect(onFormStateChange).toHaveBeenLastCalledWith({
        dirty: true,
        hasErrors: false,
      }),
    );

    await user.type(screen.getByLabelText("Image URL"), "not a url");
    await waitFor(() =>
      expect(onFormStateChange).toHaveBeenLastCalledWith({
        dirty: true,
        hasErrors: true,
      }),
    );
  });

  it("flushes the pending draft when saveRequest increments", async () => {
    const user = userEvent.setup();
    const section = makeSection();
    const { rerender, onSave } = renderWithProps({
      saveRequest: 0,
      section,
    });

    await screen.findByLabelText("Section name");
    const nameField = screen.getByLabelText("Section name");
    await user.clear(nameField);
    await user.type(nameField, "Renamed section");

    rerender(
      <SectionInspector
        section={section}
        sectionTypes={[IMAGE_TEXT_TYPE]}
        portfolioId="portfolio-1"
        onSave={onSave}
        saving={false}
        error={null}
        saveRequest={1}
      />,
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]?.name).toBe("Renamed section");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeDisabled(),
    );
  });

  it("keeps the draft marked unsaved when the save fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    renderWithProps({}, onSave);

    await screen.findByLabelText("Section name");
    await user.type(screen.getByLabelText("Section name"), "!");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("refuses to flush a draft that has validation errors", async () => {
    const user = userEvent.setup();
    const section = makeSection();
    const { rerender, onSave } = renderWithProps({
      saveRequest: 0,
      section,
    });

    await screen.findByLabelText("Section name");
    await user.type(screen.getByLabelText("Image URL"), "not a url");
    expect(
      await screen.findByText("Enter a valid http or https URL."),
    ).toBeInTheDocument();

    rerender(
      <SectionInspector
        section={section}
        sectionTypes={[IMAGE_TEXT_TYPE]}
        portfolioId="portfolio-1"
        onSave={onSave}
        saving={false}
        error={null}
        saveRequest={1}
      />,
    );

    expect(
      await screen.findByText(
        "Please fix the validation errors before saving.",
      ),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
