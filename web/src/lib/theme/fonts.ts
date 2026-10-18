/**
 * Font catalog.
 *
 * The backend restricts typography to a small, safe catalog of system font
 * stacks (no arbitrary remote font URLs in this release). This maps those keys
 * to concrete CSS `font-family` values for previews.
 */

const FONT_STACKS: Record<string, string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  humanist: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  geometric: '"Trebuchet MS", "Gill Sans", Verdana, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

const DEFAULT_STACK = FONT_STACKS.system ?? "sans-serif";

export function fontStack(key: string | undefined): string {
  return FONT_STACKS[key ?? "system"] ?? DEFAULT_STACK;
}
