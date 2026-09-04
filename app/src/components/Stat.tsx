import type { ReactNode } from "react";
import styles from "./Stat.module.css";

export interface StatProps {
  label: ReactNode;
  /** Pre-formatted value; numbers render with tabular figures. */
  value: ReactNode;
  /** Appended right after the value, e.g. "%". */
  suffix?: ReactNode;
  /** Render the number crimson — reserve it for the ONE headline metric. */
  accent?: boolean;
  hint?: ReactNode;
}

export function Stat({ label, value, suffix, accent = false, hint }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={[styles.value, accent ? styles.accent : null].filter(Boolean).join(" ")}>
        {value}
        {suffix}
      </span>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export default Stat;
