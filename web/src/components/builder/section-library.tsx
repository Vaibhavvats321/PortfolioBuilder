"use client";

import { Button } from "@/components/ui/button";
import type { SectionType } from "@/types/section";

interface SectionLibraryProps {
  sectionTypes: SectionType[];
  onAdd: (typeId: string) => void;
  disabled: boolean;
}

export function SectionLibrary({
  sectionTypes,
  onAdd,
  disabled,
}: SectionLibraryProps) {
  const groups = sectionTypes.reduce<Record<string, SectionType[]>>(
    (acc, t) => {
      const group = t.group ?? "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push(t);
      return acc;
    },
    {},
  );
  const groupOrder = Object.keys(groups);
  return (
    <div className="space-y-4">
      {groupOrder.map((group) => (
        <div key={group} className="space-y-2">
          <h4 className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {group}
          </h4>
          <ul className="space-y-2">
            {groups[group]?.map((t) => (
              <li
                key={t.type_id}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {t.label}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.description}
                  </p>
                </div>
                <Button onClick={() => onAdd(t.type_id)} disabled={disabled}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
