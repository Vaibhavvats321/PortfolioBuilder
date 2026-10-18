"use client";

import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { MediaPickerButton } from "@/components/builder/media-picker";
import { ResponsiveOverrideEditor } from "@/components/builder/responsive-override-editor";
import { defaultForField } from "@/lib/section/defaults";
import { mediaFileUrl } from "@/lib/api/media";
import type { MediaAsset } from "@/types/media";
import type { SectionContent, SectionField } from "@/types/section";

interface FieldControlProps {
  field: SectionField;
  value: unknown;
  error?: string;
  /** Dotted-path error map for nested editors (responsive overrides). */
  errors?: Record<string, string>;
  /** Sibling container values so inherited override keys display their base. */
  containerValues?: SectionContent;
  onChange: (value: unknown) => void;
  idBase: string;
  prefix: string;
  portfolioId?: string;
  onImagePicked?: (asset: MediaAsset) => void;
}

export function pathFor(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

/**
 * Renders the control for a field. Wrapped by `FieldControl` so that the
 * optional `help_text` is shown consistently for every field kind.
 */
function renderFieldControl({
  field,
  value,
  error,
  errors,
  containerValues,
  onChange,
  idBase,
  prefix,
  portfolioId,
  onImagePicked,
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
        <>
          <TextField
            id={id}
            label={field.label}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder ?? "https://example.com"}
            onChange={(event) => onChange(event.target.value)}
            error={error}
          />
          {portfolioId && field.name === "image_url" && onImagePicked ? (
            <MediaPickerButton
              portfolioId={portfolioId}
              onSelect={onImagePicked}
            />
          ) : null}
        </>
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
    case "color":
      return (
        <ColorControl
          id={id}
          field={field}
          value={typeof value === "string" ? value : ""}
          error={error}
          onChange={onChange}
        />
      );
    case "repeater":
      return (
        <RepeaterControl
          field={field}
          value={Array.isArray(value) ? value : []}
          error={error}
          errors={errors}
          onChange={onChange}
          idBase={idBase}
          prefix={prefix}
          portfolioId={portfolioId}
        />
      );
    case "object":
      return (
        <ResponsiveOverrideEditor
          field={field}
          value={value}
          error={error}
          errors={errors ?? {}}
          containerValues={containerValues ?? {}}
          onChange={onChange}
          idBase={idBase}
          prefix={prefix}
        />
      );
    default:
      return null;
  }
}

function FieldControl(props: FieldControlProps) {
  return (
    <div className="space-y-1">
      {renderFieldControl(props)}
      {props.field.help_text ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {props.field.help_text}
        </p>
      ) : null}
    </div>
  );
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface ColorControlProps {
  id: string;
  field: SectionField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function ColorControl({
  id,
  field,
  value,
  error,
  onChange,
}: ColorControlProps) {
  const swatch = HEX_COLOR.test(value) ? value : "#000000";
  return (
    <div className="space-y-1 text-sm">
      <label
        htmlFor={id}
        className="block font-medium text-slate-700 dark:text-slate-300"
      >
        {field.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${field.label} swatch`}
          value={swatch}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white dark:border-slate-700"
        />
        <input
          id={id}
          type="text"
          value={value}
          placeholder={field.placeholder ?? "#rrggbb (empty inherits)"}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
            "focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
            "dark:bg-slate-950 dark:text-slate-100",
            error
              ? "border-rose-500"
              : "border-slate-300 dark:border-slate-700",
          ].join(" ")}
        />
        {value ? (
          <Button variant="secondary" onClick={() => onChange("")}>
            Clear
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}

interface RepeaterControlProps {
  field: SectionField;
  value: unknown[];
  error?: string;
  errors?: Record<string, string>;
  onChange: (value: unknown[]) => void;
  idBase: string;
  prefix: string;
  portfolioId?: string;
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
  errors,
  onChange,
  idBase,
  prefix,
  portfolioId,
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
  function updateItemBatch(index: number, updates: Record<string, unknown>) {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const base =
        item && typeof item === "object" ? (item as SectionContent) : {};
      return { ...base, ...updates };
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
                  errors={errors ?? {}}
                  onChange={(childName, childValue) =>
                    updateItem(index, childName, childValue)
                  }
                  onPickImage={(updates) => updateItemBatch(index, updates)}
                  portfolioId={portfolioId}
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
  /**
   * Applies a media selection to several keys at once (image URL plus its
   * sibling alt text). The inspector passes a batch handler backed by a
   * functional state update; without it the updates fall back to sequential
   * `onChange` calls.
   */
  onPickImage?: (updates: Record<string, unknown>) => void;
  portfolioId?: string;
  idPrefix: string;
  prefix: string;
}

export function SectionFieldsForm({
  fields,
  values,
  errors,
  onChange,
  onPickImage,
  portfolioId,
  idPrefix,
  prefix,
}: SectionFieldsFormProps) {
  function makeImagePickHandler(
    field: SectionField,
  ): ((asset: MediaAsset) => void) | undefined {
    if (!portfolioId || field.kind !== "url") return undefined;
    if (field.name !== "image_url") return undefined;
    return (asset) => {
      const updates: Record<string, unknown> = {
        [field.name]: mediaFileUrl(asset.id),
      };
      if (fields.some((sibling) => sibling.name === "image_alt")) {
        updates.image_alt = asset.alt_text ?? "";
      }
      if (onPickImage) {
        onPickImage(updates);
      } else {
        Object.entries(updates).forEach(([key, next]) => onChange(key, next));
      }
    };
  }

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
            errors={errors}
            containerValues={values}
            onChange={(value) => onChange(field.name, value)}
            onImagePicked={makeImagePickHandler(field)}
            portfolioId={portfolioId}
            idBase={idPrefix}
            prefix={prefix}
          />
        );
      })}
    </div>
  );
}
