"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import {
  validatePageSlug,
  validatePageTitle,
  validateSeoDescription,
  validateSeoTitle,
} from "@/lib/page/validation";

export interface PageFormValues {
  title: string;
  slug: string;
  isVisible: boolean;
  seoTitle: string;
  seoDescription: string;
}

interface FieldErrors {
  title?: string;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
}

interface PageFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<PageFormValues>;
  submitting?: boolean;
  formError?: string | null;
  onSubmit: (values: PageFormValues) => void;
  onCancel?: () => void;
}

export function PageForm({
  mode,
  initialValues,
  submitting = false,
  formError = null,
  onSubmit,
  onCancel,
}: PageFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [isVisible, setIsVisible] = useState(initialValues?.isVisible ?? true);
  const [seoTitle, setSeoTitle] = useState(initialValues?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initialValues?.seoDescription ?? "",
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      title: validatePageTitle(title),
      slug: validatePageSlug(slug),
      seoTitle: validateSeoTitle(seoTitle),
      seoDescription: validateSeoDescription(seoDescription),
    };
    setErrors(nextErrors);
    if (
      nextErrors.title ||
      nextErrors.slug ||
      nextErrors.seoTitle ||
      nextErrors.seoDescription
    ) {
      return;
    }

    onSubmit({
      title: title.trim(),
      slug: slug.trim(),
      isVisible,
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id={`${mode}-page-title`}
        label="Title"
        value={title}
        error={errors.title}
        onChange={(event) => setTitle(event.target.value)}
        autoComplete="off"
      />
      <TextField
        id={`${mode}-page-slug`}
        label="Slug"
        value={slug}
        error={errors.slug}
        placeholder="my-page"
        onChange={(event) => setSlug(event.target.value)}
        autoComplete="off"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Leave blank to generate from the title. Slugs must be unique within the
        portfolio.
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={(event) => setIsVisible(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Visible to visitors
      </label>
      <TextField
        id={`${mode}-page-seo-title`}
        label="SEO title"
        value={seoTitle}
        error={errors.seoTitle}
        onChange={(event) => setSeoTitle(event.target.value)}
        autoComplete="off"
      />
      <TextArea
        id={`${mode}-page-seo-description`}
        label="SEO description"
        value={seoDescription}
        error={errors.seoDescription}
        rows={3}
        onChange={(event) => setSeoDescription(event.target.value)}
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
            : mode === "create"
              ? "Create page"
              : "Save page"}
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
