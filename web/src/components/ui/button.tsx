import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary";

const BASE_CLASSES = [
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
  "transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300",
  secondary:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
};

/** Shared button styling for `<button>` elements and link-styled actions. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], className ?? ""]
    .join(" ")
    .trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      {...props}
    />
  );
}
