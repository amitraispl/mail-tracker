import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary";

/** Class names for the button look, so an <a>/next-Link can share the style.
 *  Kept out of Button.tsx on principle, not necessity: Button.tsx has no
 *  hooks and no "use client" of its own, but if it ever needs one again,
 *  this staying separate means Server Components (page.tsx files, styling
 *  plain <Link> elements with this) never break — every export of a
 *  "use client" module becomes a client-only reference, even a plain
 *  string-returning helper like this one. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  block = false,
  extra?: string,
  shimmer = false,
): string {
  return [
    styles.button,
    styles[variant],
    block ? styles.block : null,
    shimmer ? styles.shimmer : null,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export default buttonClassName;
