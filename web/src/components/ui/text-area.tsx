import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
}

export function TextArea({
  id,
  label,
  error,
  className,
  ...props
}: TextAreaProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
          "dark:bg-slate-950 dark:text-slate-100",
          error ? "border-rose-500" : "border-slate-300 dark:border-slate-700",
          className ?? "",
        ]
          .join(" ")
          .trim()}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
