"use client";

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import styles from "./sending.module.css";

export interface EmailTagInputProps {
  id: string;
  label: string;
  hint?: string;
  tags: string[];
  onChange: (next: string[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits on newline, comma, semicolon or tab — covers a pasted Excel column
 *  (newline-separated) as well as a comma/semicolon-separated CSV row. */
function splitEmails(raw: string): string[] {
  return raw
    .split(/[\n\r,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EmailTagInput({ id, label, hint, tags, onChange }: EmailTagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTags(raw: string) {
    const incoming = splitEmails(raw);
    if (incoming.length === 0) return;
    const seen = new Set(tags.map((t) => t.toLowerCase()));
    const next = [...tags];
    for (const email of incoming) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(email);
    }
    onChange(next);
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    // Anything that looks like more than one bare word (a list, a paste from
    // Excel/Sheets) gets tokenized; a single plain word is left for normal
    // typing so paste-to-edit-one-address still behaves like a text input.
    if (/[\n\r,;\t]/.test(text)) {
      event.preventDefault();
      addTags(text);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";" || event.key === "Tab") {
      if (draft.trim()) {
        event.preventDefault();
        addTags(draft);
        setDraft("");
      }
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleBlur() {
    if (draft.trim()) {
      addTags(draft);
      setDraft("");
    }
  }

  return (
    <div className={styles.tagField}>
      <label className={styles.tagLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.tagBox} onClick={() => inputRef.current?.focus()}>
        {tags.map((email, i) => (
          <span
            key={`${email}-${i}`}
            className={[styles.tag, EMAIL_RE.test(email) ? null : styles.tagInvalid]
              .filter(Boolean)
              .join(" ")}
          >
            {email}
            <button
              type="button"
              className={styles.tagRemove}
              aria-label={`Remove ${email}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          className={styles.tagInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? "jane@example.com, john@example.com…" : ""}
        />
      </div>
      {hint && <p className={styles.tagHint}>{hint}</p>}
    </div>
  );
}

export default EmailTagInput;
