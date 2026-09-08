import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";
import { buttonClassName, type ButtonVariant } from "./buttonClassName";

export type { ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch to the full width of the parent. */
  block?: boolean;
  /** "You should click this" cue — red fill + a thin rotating spark at the
   *  edge. Overrides `variant`'s look (always renders on the primary red). */
  shimmer?: boolean;
}

/** No hooks here on purpose — this stays a plain component (no "use client")
 *  so it never forces a client boundary of its own. It's always rendered
 *  from inside a component that's already "use client" (a form, a button
 *  handler); Server Components only ever use `buttonClassName` directly on a
 *  plain `<Link>`, never this component. */
export function Button({
  variant = "primary",
  block = false,
  shimmer = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const showShimmer = shimmer && !rest.disabled;

  return (
    <button
      type={type}
      className={buttonClassName(variant, block, className, shimmer)}
      {...rest}
    >
      {showShimmer && (
        <>
          <span className={styles.shimmerSpark} aria-hidden="true">
            <span className={styles.shimmerSlide}>
              <span className={styles.shimmerSpin} />
            </span>
          </span>
          <span className={styles.shimmerBackdrop} aria-hidden="true" />
          <span className={styles.shimmerHighlight} aria-hidden="true" />
        </>
      )}
      {children}
    </button>
  );
}

export default Button;
