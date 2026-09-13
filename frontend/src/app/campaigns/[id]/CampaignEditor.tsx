"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field } from "@/components";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard.module.css";

export interface CampaignEditorProps {
  id: string;
  name: string;
  subject: string | null;
}

export function CampaignEditor({ id, name: initialName, subject: initialSubject }: CampaignEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameDirty =
    (name.trim() !== initialName.trim() && name.trim().length > 0) ||
    subject.trim() !== (initialSubject ?? "").trim();

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setNameStatus(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name can't be empty.");
      return;
    }

    setSavingName(true);
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, subject: subject.trim() }),
      });
      if (!response.ok) {
        throw new Error(`Could not save (${response.status}).`);
      }
      setNameStatus("Saved.");
      router.refresh();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div>
      <form onSubmit={saveName} noValidate className={styles.controls}>
        <div className={styles.nameField}>
          <Field
            id="campaign-name"
            label="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={styles.nameField}>
          <Field
            id="campaign-subject"
            label="Subject line"
            placeholder="Defaults to the campaign name"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoComplete="off"
            hint="Used when sending via the platform. Leave blank to fall back to the campaign name."
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={savingName}
          shimmer={nameDirty && !savingName}
          className={styles.controlsButton}
        >
          {savingName ? "Saving…" : "Save"}
        </Button>
      </form>
      {(nameError || nameStatus) && (
        <p
          className={[styles.status, nameError ? styles.statusError : null]
            .filter(Boolean)
            .join(" ")}
          role={nameError ? "alert" : "status"}
        >
          {nameError ?? nameStatus}
        </p>
      )}
    </div>
  );
}

export default CampaignEditor;
