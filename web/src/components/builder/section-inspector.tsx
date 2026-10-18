"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SectionFieldsForm } from "@/components/builder/section-fields";
import { validateSectionFields } from "@/lib/section/validation";
import type {
  PageSection,
  SectionContent,
  SectionStyle,
  SectionType,
} from "@/types/section";

/** Form state mirrored to the editor toolbar (save status, Save Draft). */
export interface SectionInspectorFormState {
  dirty: boolean;
  hasErrors: boolean;
}

interface SectionInspectorProps {
  section: PageSection | null;
  sectionTypes: SectionType[];
  portfolioId: string;
  /** Persists the draft. Resolves `true` only when the save succeeded. */
  onSave: (patch: {
    name?: string;
    is_visible?: boolean;
    content?: SectionContent;
    layout?: SectionLayout;
    style?: SectionStyle;
  }) => Promise<boolean>;
  saving: boolean;
  error: string | null;
  onFormStateChange?: (state: SectionInspectorFormState) => void;
  /** Incremented by the editor toolbar to flush this inspector's draft. */
  saveRequest?: number;
}

type SectionLayout = Record<string, unknown>;

interface Draft {
  name: string;
  isVisible: boolean;
  content: SectionContent;
  layout: SectionLayout;
  style: SectionStyle;
}

export function SectionInspector({
  section,
  sectionTypes,
  portfolioId,
  onSave,
  saving,
  error,
  onFormStateChange,
  saveRequest,
}: SectionInspectorProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const lastReported = useRef<SectionInspectorFormState>({
    dirty: false,
    hasErrors: false,
  });

  useEffect(() => {
    if (!section) {
      const timer = setTimeout(() => {
        setDraft(null);
        setDirty(false);
        setLocalError(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setDraft({
        name: section.name,
        isVisible: section.is_visible,
        content: { ...section.content },
        layout: { ...section.layout },
        style: { ...section.style },
      });
      setDirty(false);
      setLocalError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [section]);

  const sectionType = useMemo(() => {
    if (!section) return undefined;
    return sectionTypes.find((t) => t.type_id === section.section_type);
  }, [section, sectionTypes]);

  const contentErrors = useMemo(() => {
    if (!draft || !sectionType) return {};
    return validateSectionFields(sectionType.content_fields, draft.content);
  }, [draft, sectionType]);

  const layoutErrors = useMemo(() => {
    if (!draft || !sectionType) return {};
    return validateSectionFields(sectionType.layout_fields, draft.layout);
  }, [draft, sectionType]);

  const styleErrors = useMemo(() => {
    if (!draft || !sectionType) return {};
    return validateSectionFields(sectionType.style_fields, draft.style);
  }, [draft, sectionType]);

  const allErrors = useMemo(
    () => ({ ...contentErrors, ...layoutErrors, ...styleErrors }),
    [contentErrors, layoutErrors, styleErrors],
  );
  const hasErrors = Object.keys(allErrors).length > 0;

  // Mirror dirty/validation state to the toolbar. Only report when the values
  // actually change so a fresh callback identity cannot loop the parent.
  useEffect(() => {
    if (
      lastReported.current.dirty === dirty &&
      lastReported.current.hasErrors === hasErrors
    ) {
      return;
    }
    lastReported.current = { dirty, hasErrors };
    onFormStateChange?.({ dirty, hasErrors });
  }, [dirty, hasErrors, onFormStateChange]);

  // Refresh the save trigger after every render so it always calls the
  // latest handleSave closure (fresh draft and validation state).
  useEffect(() => {
    saveRef.current = () => {
      void handleSave();
    };
  });

  useEffect(() => {
    if (!saveRequest) return;
    saveRef.current();
  }, [saveRequest]);

  function updateDraft(updates: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...updates } : null));
    setDirty(true);
    setLocalError(null);
  }

  /**
   * Applies a media selection to a whole container (content/layout/style) in
   * one functional update, so the image URL and its sibling alt text never
   * overwrite each other through stale closures.
   */
  function pickImageInto(
    container: "content" | "layout" | "style",
    updates: Record<string, unknown>,
  ) {
    setDraft((d) => {
      if (!d) return null;
      const next: Draft = { ...d };
      next[container] = { ...d[container], ...updates };
      return next;
    });
    setDirty(true);
    setLocalError(null);
  }

  async function handleSave(): Promise<boolean> {
    if (!section || !draft || !sectionType) return false;
    if (hasErrors) {
      setLocalError("Please fix the validation errors before saving.");
      return false;
    }
    if (!dirty) return true;
    const saved = await onSave({
      name: draft.name,
      is_visible: draft.isVisible,
      content: draft.content,
      layout: draft.layout,
      style: draft.style,
    });
    if (saved) setDirty(false);
    return saved;
  }

  function handleReset() {
    if (!section) return;
    setDraft({
      name: section.name,
      isVisible: section.is_visible,
      content: { ...section.content },
      layout: { ...section.layout },
      style: { ...section.style },
    });
    setDirty(false);
    setLocalError(null);
  }

  if (!section || !draft || !sectionType) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Select a section to edit its content and settings.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <TextField
          id="section-name"
          label="Section name"
          value={draft.name}
          onChange={(event) => updateDraft({ name: event.target.value })}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={draft.isVisible}
            onChange={(event) =>
              updateDraft({ isVisible: event.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          Visible on page
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Type: {sectionType.label}
        </p>
      </div>

      {sectionType.content_fields.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Content
          </h3>
          <SectionFieldsForm
            fields={sectionType.content_fields}
            values={draft.content}
            errors={contentErrors}
            onChange={(name, value) =>
              updateDraft({ content: { ...draft.content, [name]: value } })
            }
            onPickImage={(updates) => pickImageInto("content", updates)}
            portfolioId={portfolioId}
            idPrefix={`content-${section.id}`}
            prefix=""
          />
        </section>
      )}

      {sectionType.layout_fields.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Layout
          </h3>
          <SectionFieldsForm
            fields={sectionType.layout_fields}
            values={draft.layout}
            errors={layoutErrors}
            onChange={(name, value) =>
              updateDraft({ layout: { ...draft.layout, [name]: value } })
            }
            onPickImage={(updates) => pickImageInto("layout", updates)}
            portfolioId={portfolioId}
            idPrefix={`layout-${section.id}`}
            prefix=""
          />
        </section>
      )}

      {sectionType.style_fields.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Style overrides
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Optional. Leave as inherit to use the portfolio theme.
          </p>
          <SectionFieldsForm
            fields={sectionType.style_fields}
            values={draft.style}
            errors={styleErrors}
            onChange={(name, value) =>
              updateDraft({ style: { ...draft.style, [name]: value } })
            }
            onPickImage={(updates) => pickImageInto("style", updates)}
            portfolioId={portfolioId}
            idPrefix={`style-${section.id}`}
            prefix=""
          />
        </section>
      )}

      {(error || localError) && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error ?? localError}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !dirty || hasErrors}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
