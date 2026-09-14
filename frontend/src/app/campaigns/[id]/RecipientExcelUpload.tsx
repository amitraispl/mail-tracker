"use client";

import { Field } from "@/components";

export interface RecipientExcelUploadProps {
  fileInputKey: number;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
}

/** Just the file field — staged, not uploaded. The parent's "Add to list"
 *  button is what actually submits it (see RecipientsPanel), same as the
 *  plain-paste tags below it: pick/paste, then one explicit click adds. */
export function RecipientExcelUpload({ fileInputKey, disabled, onFileChange }: RecipientExcelUploadProps) {
  return (
    <Field
      key={fileInputKey}
      id="recipient-excel"
      label="Or upload a spreadsheet"
      type="file"
      accept=".xlsx"
      disabled={disabled}
      onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      hint={
        <>
          .xlsx with an <strong>email</strong> column and a <strong>name</strong> (or{" "}
          <strong>company</strong>) column — names let the tracked HTML personalize with{" "}
          <code>{"{{name}}"}</code>. Rows missing either value are skipped, not guessed.
        </>
      }
    />
  );
}

export default RecipientExcelUpload;
