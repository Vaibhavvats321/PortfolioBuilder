"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import {
  validatePortfolioDescription,
  validatePortfolioName,
  validatePortfolioSlug,
} from "@/lib/portfolio/validation";

export interface PortfolioFormValues {
  name: string;
  slug: string;
  description: string;
}

interface FieldErrors {
  name?: string;
  slug?: string;
  description?: string;
}

interface PortfolioFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<PortfolioFormValues>;
  submitting?: boolean;
  formError?: string | null;
  submitLabel?: string;
  onSubmit: (values: PortfolioFormValues) => void;
  onCancel?: () => void;
}

export function PortfolioForm({
  mode,
  initialValues,
  submitting = false,
  formError = null,
  submitLabel,
  onSubmit,
  onCancel,
}: PortfolioFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      name: validatePortfolioName(name),
      slug: validatePortfolioSlug(slug),
      description: validatePortfolioDescription(description),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.slug || nextErrors.description) {
      return;
    }

    onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
    });
  }

  const slugHelper =
    mode === "create" ? "Leave blank to generate from the name." : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id={`${mode}-portfolio-name`}
        label="Name"
        value={name}
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="off"
      />
      <TextField
        id={`${mode}-portfolio-slug`}
        label="Slug"
        value={slug}
        error={errors.slug}
        placeholder="my-portfolio"
        onChange={(event) => setSlug(event.target.value)}
        autoComplete="off"
      />
      {slugHelper ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {slugHelper}
        </p>
      ) : null}
      <TextArea
        id={`${mode}-portfolio-description`}
        label="Description"
        value={description}
        error={errors.description}
        rows={3}
        onChange={(event) => setDescription(event.target.value)}
        autoComplete="off"
      />
      {formError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : (submitLabel ??
              (mode === "create" ? "Create portfolio" : "Save changes"))}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
