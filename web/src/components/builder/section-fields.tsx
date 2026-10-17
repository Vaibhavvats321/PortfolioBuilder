"use client";

import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { defaultForField } from "@/lib/section/defaults";
import type { SectionContent, SectionField } from "@/types/section";

interface FieldControlProps {
  field: SectionField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  idBase: string;
  prefix: string;
}

function pathFor(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

function FieldControl({
  field,
  value,
  error,
  onChange,
  idBase,
  prefix,
}: FieldControlProps) {
  const id = `${idBase}-${pathFor(prefix, field.name).replace(/\./g, "-")}`;
  switch (field.kind) {
    case "text":
      return (
        <TextField
          id={id}
          label={field.label}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? undefined}
          onChange={(event) => onChange(event.target.value)}
          error={error}
        />
      );
    case "textarea":
      return (
        <TextArea
          id={id}
          label={field.label}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? undefined}
          onChange={(event) => onChange(event.target.value)}
          error={error}
        />
      );
    case "url":
      return (
        <TextField
          id={id}
          label={field.label}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? "https://example.com"}
          onChange={(event) => onChange(event.target.value)}
          error={error}
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            id={id}
            type="checkbox"
            checked={typeof value === "boolean" ? value : false}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {field.label}
          {error ? (
            <span className="ml-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </span>
          ) : null}
        </label>
      );
    case "select":
      return (
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-slate-700 dark:text-slate-300">
            {field.label}
          </span>
          <select
            id={id}
            value={typeof value === "string" ? value : (field.options[0] ?? "")}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error ? (
            <span className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </span>
          ) : null}
        </label>
      );
    case "repeater":
      return (
        <RepeaterControl
          field={field}
          value={Array.isArray(value) ? value : []}
          error={error}
          onChange={onChange}
          idBase={idBase}
          prefix={prefix}
        />
      );
    default:
      return null;
  }
}

interface RepeaterControlProps {
  field: SectionField;
  value: unknown[];
  error?: string;
  onChange: (value: unknown[]) => void;
  idBase: string;
  prefix: string;
}

function makeKey(index: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${index}-${crypto.randomUUID()}`;
  }
  return `${index}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function RepeaterControl({
  field,
  value,
  error,
  onChange,
  idBase,
  prefix,
}: RepeaterControlProps) {
  const items = value;
  function addItem() {
    const nextItem = Object.fromEntries(
      field.fields.map((child) => [child.name, defaultForField(child)]),
    );
    onChange([...items, nextItem]);
  }
  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    const a = items[index];
    const b = items[target];
    if (!a || !b) return;
    const next = [...items];
    next[index] = b;
    next[target] = a;
    onChange(next);
  }
  function updateItem(index: number, childName: string, childValue: unknown) {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const base =
        item && typeof item === "object" ? (item as SectionContent) : {};
      return { ...base, [childName]: childValue };
    });
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {field.label}
          {field.max_items ? ` (max ${field.max_items})` : ""}
        </span>
        <Button variant="secondary" onClick={addItem}>
          Add {field.item_label ?? "item"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
      <ul className="space-y-3">
        {items.map((item, index) => {
          const itemValues =
            item && typeof item === "object" ? (item as SectionContent) : {};
          const itemPrefix = `${pathFor(prefix, field.name)}.${index}`;
          return (
            <li
              key={makeKey(index)}
              className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {field.item_label ?? "Item"} {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  <Button variant="secondary" onClick={() => removeItem(index)}>
                    Remove
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <SectionFieldsForm
                  fields={field.fields}
                  values={itemValues}
                  errors={{}} // errors passed from parent; parent keys include full path
                  onChange={(childName, childValue) =>
                    updateItem(index, childName, childValue)
                  }
                  idPrefix={idBase}
                  prefix={itemPrefix}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SectionFieldsFormProps {
  fields: SectionField[];
  values: SectionContent;
  errors: Record<string, string>;
  onChange: (name: string, value: unknown) => void;
  idPrefix: string;
  prefix: string;
}

export function SectionFieldsForm({
  fields,
  values,
  errors,
  onChange,
  idPrefix,
  prefix,
}: SectionFieldsFormProps) {
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const path = pathFor(prefix, field.name);
        return (
          <FieldControl
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[path]}
            onChange={(value) => onChange(field.name, value)}
            idBase={idPrefix}
            prefix={prefix}
          />
        );
      })}
    </div>
  );
}
