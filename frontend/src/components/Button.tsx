import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch to the full width of the parent. */
  block?: boolean;
}

/** Class names for the button look, so an <a>/next-Link can share the style. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  block = false,
  extra?: string,
): string {
  return [styles.button, styles[variant], block ? styles.block : null, extra]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  block = false,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, block, className)}
      {...rest}
    />
  );
}

export default Button;
