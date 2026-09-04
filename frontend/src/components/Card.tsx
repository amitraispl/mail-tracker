import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-hand slot in the card header. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Drop the inner padding (e.g. when the card wraps a DataTable). */
  flush?: boolean;
  children?: ReactNode;
}

export function Card({
  title,
  description,
  actions,
  footer,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <div
      className={[styles.card, flush ? styles.flush : null, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {hasHeader && (
        <div className={styles.header}>
          <div>
            {title && <h2 className={styles.heading}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

export default Card;
