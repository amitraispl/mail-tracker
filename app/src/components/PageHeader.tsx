import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  /** Page title rendered under the masthead. Omit for a bare masthead. */
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /** Right-hand slot in the masthead bar (buttons, links). */
  actions?: ReactNode;
  /** Where the wordmark links to; pass null for a non-clickable mark. */
  homeHref?: string | null;
}

const LOGO_SRC = "/brand/illumia-logo.png";
const LOGO_ALT = "Illumia Solutions";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  homeHref = "/",
}: PageHeaderProps) {
  /* eslint-disable-next-line @next/next/no-img-element */
  const logo = <img src={LOGO_SRC} alt={LOGO_ALT} className={styles.logo} width={132} height={32} />;

  return (
    <header>
      <div className={styles.masthead}>
        <div className={`container ${styles.bar}`}>
          {homeHref ? (
            <a href={homeHref} className={styles.brand} aria-label={`${LOGO_ALT} — home`}>
              {logo}
            </a>
          ) : (
            <span className={styles.brand}>{logo}</span>
          )}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </div>

      {(title || subtitle || eyebrow) && (
        <div className={`container ${styles.titles}`}>
          {eyebrow}
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
