"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SectionFieldsForm } from "@/components/builder/section-fields";
import { validateSectionFields } from "@/lib/section/validation";
import type { PageSection, SectionContent, SectionType } from "@/types/section";

interface SectionInspectorProps {
  section: PageSection | null;
  sectionTypes: SectionType[];
  onSave: (patch: {
    name?: string;
    is_visible?: boolean;
    content?: SectionContent;
    layout?: SectionLayout;
  }) => Promise<void>;
  saving: boolean;
  error: string | null;
}

type SectionLayout = Record<string, unknown>;

interface Draft {
  name: string;
  isVisible: boolean;
  content: SectionContent;
  layout: SectionLayout;
}

export function SectionInspector({
  section,
  sectionTypes,
  onSave,
  saving,
  error,
}: SectionInspectorProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const allErrors = useMemo(
    () => ({ ...contentErrors, ...layoutErrors }),
    [contentErrors, layoutErrors],
  );
  const hasErrors = Object.keys(allErrors).length > 0;

  function updateDraft(updates: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...updates } : null));
    setDirty(true);
    setLocalError(null);
  }

  async function handleSave() {
    if (!section || !draft || !sectionType) return;
    if (hasErrors) {
      setLocalError("Please fix the validation errors before saving.");
      return;
    }
    await onSave({
      name: draft.name,
      is_visible: draft.isVisible,
      content: draft.content,
      layout: draft.layout,
    });
    setDirty(false);
  }

  function handleReset() {
    if (!section) return;
    setDraft({
      name: section.name,
      isVisible: section.is_visible,
      content: { ...section.content },
      layout: { ...section.layout },
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
            idPrefix={`layout-${section.id}`}
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
