import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Primary next step, e.g. a "New campaign" button. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.badge}
        src="/brand/illumia-mark.png"
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
      />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export default EmptyState;
