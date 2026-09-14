"use client";

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import styles from "./sending.module.css";

export interface EmailEntry {
  email: string;
  name?: string;
}

export interface EmailTagInputProps {
  id: string;
  label: string;
  hint?: string;
  tags: EmailEntry[];
  onChange: (next: EmailEntry[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One line -> one entry, so a name paired with its email survives instead
 *  of being flattened into two separate tokens. Recognizes, in order:
 *    - "Name <email@x.com>" (the format mail clients paste addresses in)
 *    - "email@x.com<TAB>Name" (pasting two Excel/Sheets columns — a row
 *      copies as tab-separated) — order-agnostic, whichever side is a
 *      valid email is the email
 *    - "email@x.com, Name" / "email@x.com; Name" (single separator, one
 *      side an email and the other not)
 *  Anything else falls back to the old behavior: split the line on
 *  comma/semicolon/tab into bare addresses (multiple addresses per line). */
function parseLine(line: string): EmailEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const bracket = trimmed.match(/^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  if (bracket) {
    const email = bracket[2].trim().toLowerCase();
    const name = bracket[1].trim().replace(/^["']|["']$/g, "");
    if (EMAIL_RE.test(email)) return [{ email, name: name || undefined }];
  }

  if (trimmed.includes("\t")) {
    const parts = trimmed.split("\t").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const [a, b] = parts;
      if (EMAIL_RE.test(a) && !EMAIL_RE.test(b)) return [{ email: a.toLowerCase(), name: b }];
      if (EMAIL_RE.test(b) && !EMAIL_RE.test(a)) return [{ email: b.toLowerCase(), name: a }];
    }
  }

  const singleSep = trimmed.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (singleSep.length === 2) {
    const [a, b] = singleSep;
    if (EMAIL_RE.test(a) && !EMAIL_RE.test(b)) return [{ email: a.toLowerCase(), name: b }];
    if (EMAIL_RE.test(b) && !EMAIL_RE.test(a)) return [{ email: b.toLowerCase(), name: a }];
  }

  return trimmed
    .split(/[,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email: EMAIL_RE.test(email) ? email.toLowerCase() : email }));
}

function parseEntries(raw: string): EmailEntry[] {
  return raw.split(/\r?\n/).flatMap(parseLine);
}

export function EmailTagInput({ id, label, hint, tags, onChange }: EmailTagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addEntries(raw: string) {
    const incoming = parseEntries(raw);
    if (incoming.length === 0) return;
    const seen = new Set(tags.map((t) => t.email.toLowerCase()));
    const next = [...tags];
    for (const entry of incoming) {
      const key = entry.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(entry);
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
      addEntries(text);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";" || event.key === "Tab") {
      if (draft.trim()) {
        event.preventDefault();
        addEntries(draft);
        setDraft("");
      }
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleBlur() {
    if (draft.trim()) {
      addEntries(draft);
      setDraft("");
    }
  }

  return (
    <div className={styles.tagField}>
      <label className={styles.tagLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.tagBox} onClick={() => inputRef.current?.focus()}>
        {tags.map((entry, i) => (
          <span
            key={`${entry.email}-${i}`}
            className={[styles.tag, EMAIL_RE.test(entry.email) ? null : styles.tagInvalid]
              .filter(Boolean)
              .join(" ")}
          >
            {entry.name ? `${entry.name} <${entry.email}>` : entry.email}
            <button
              type="button"
              className={styles.tagRemove}
              aria-label={`Remove ${entry.email}`}
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
          placeholder={tags.length === 0 ? "Jane Doe <jane@example.com>, john@example.com…" : ""}
        />
      </div>
      {hint && <p className={styles.tagHint}>{hint}</p>}
    </div>
  );
}

export default EmailTagInput;
