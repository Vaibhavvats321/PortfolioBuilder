/**
 * WCAG contrast helpers.
 *
 * Used to warn about low-contrast theme combinations in the Design Studio
 * (for example body text against the page background). This is advisory only;
 * the backend does not reject low-contrast themes.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` or `#rrggbb` into RGB, or return `null` for invalid input. */
export function hexToRgb(hex: string): Rgb | null {
  const match = /^#(?:([0-9a-fA-F]{3})|([0-9a-fA-F]{6}))$/.exec(hex.trim());
  if (!match) {
    return null;
  }
  const digits = match[1] ?? match[2];
  if (!digits) {
    return null;
  }
  if (digits.length === 3) {
    return {
      r: parseInt(digits[0]! + digits[0]!, 16),
      g: parseInt(digits[1]! + digits[1]!, 16),
      b: parseInt(digits[2]! + digits[2]!, 16),
    };
  }
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** Return the WCAG contrast ratio (1–21) or `null` when either color is invalid. */
export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) {
    return null;
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text. */
export function meetsWcagAA(ratio: number, largeText = false): boolean {
  return ratio >= (largeText ? 3 : 4.5);
}
