import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import styles from "./Field.module.css";

interface FieldBase {
  /** Required: also wires up htmlFor / aria-describedby. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export type FieldProps =
  | (FieldBase & { as?: "input" } & Omit<
        InputHTMLAttributes<HTMLInputElement>,
        "id"
      >)
  | (FieldBase & { as: "textarea" } & Omit<
        TextareaHTMLAttributes<HTMLTextAreaElement>,
        "id"
      >);

export function Field(props: FieldProps) {
  const { id, label, hint, error } = props;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
  };

  let control: ReactNode;
  if (props.as === "textarea") {
    const { id: _id, label: _label, hint: _hint, error: _error, as: _as, className, ...rest } = props;
    control = (
      <textarea
        {...shared}
        {...rest}
        className={[styles.control, styles.textarea, error ? styles.invalid : null, className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  } else {
    const { id: _id, label: _label, hint: _hint, error: _error, as: _as, className, ...rest } = props;
    control = (
      <input
        {...shared}
        {...rest}
        className={[styles.control, error ? styles.invalid : null, className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {props.required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export default Field;
