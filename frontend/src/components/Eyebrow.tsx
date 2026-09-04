import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Eyebrow.module.css";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  /** Render neutral instead of crimson (keeps primary under ~15% of the UI). */
  muted?: boolean;
  children: ReactNode;
}

export function Eyebrow({ muted = false, className, children, ...rest }: EyebrowProps) {
  return (
    <span
      className={[styles.eyebrow, muted ? styles.muted : null, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Eyebrow;
