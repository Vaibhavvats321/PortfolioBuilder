"use client";

import { Button } from "@/components/ui/button";
import type { PageSection, SectionType } from "@/types/section";

interface SectionListProps {
  sections: PageSection[];
  selectedId: string | null;
  onSelect: (sectionId: string | null) => void;
  onMove: (sectionId: string, direction: -1 | 1) => void;
  onToggleVisibility: (section: PageSection) => void;
  onDuplicate: (section: PageSection) => void;
  onDelete: (section: PageSection) => void;
  busyId: string | null;
  sectionTypes: SectionType[];
}

function typeLabel(section: PageSection, sectionTypes: SectionType[]): string {
  const def = sectionTypes.find((t) => t.type_id === section.section_type);
  return def?.label ?? section.section_type;
}

export function SectionList({
  sections,
  selectedId,
  onSelect,
  onMove,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  busyId,
  sectionTypes,
}: SectionListProps) {
  if (sections.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No sections yet. Add one from the library to get started.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {sections.map((section, index) => {
        const isSelected = section.id === selectedId;
        const isBusy = busyId === section.id;
        return (
          <li
            key={section.id}
            className={[
              "rounded-md border bg-white p-3 transition-colors dark:bg-slate-900",
              isSelected
                ? "border-slate-900 dark:border-slate-100"
                : "border-slate-200 dark:border-slate-700",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : section.id)}
                className="min-w-0 text-left"
              >
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {section.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {typeLabel(section, sectionTypes)} ·{" "}
                  {section.is_visible ? "Visible" : "Hidden"}
                </p>
              </button>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  onClick={() => onMove(section.id, -1)}
                  disabled={index === 0 || isBusy}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onMove(section.id, 1)}
                  disabled={index === sections.length - 1 || isBusy}
                  aria-label="Move down"
                >
                  ↓
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => onToggleVisibility(section)}
                disabled={isBusy}
              >
                {section.is_visible ? "Hide" : "Show"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onDuplicate(section)}
                disabled={isBusy}
              >
                Duplicate
              </Button>
              <Button
                variant="secondary"
                onClick={() => onDelete(section)}
                disabled={isBusy}
              >
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
