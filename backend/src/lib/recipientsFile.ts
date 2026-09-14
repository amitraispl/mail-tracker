import ExcelJS from "exceljs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipientRow {
  email: string;
  name: string;
}

export interface ParseRecipientsResult {
  rows: ParsedRecipientRow[];
  /** Human-readable, one per skipped row/problem — surfaced to the uploader as-is. */
  invalid: string[];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value).trim();
}

/** Reads an uploaded .xlsx recipient list: expects a header row with one
 *  column whose header contains "email" and one whose header contains
 *  "name" or "company" (case-insensitive, column order doesn't matter —
 *  "Company"/"Company Name" is treated as the name column). A row missing
 *  either value is rejected outright rather than sent with a blank
 *  {{name}}. */
export async function parseRecipientsWorkbook(buffer: Buffer): Promise<ParseRecipientsResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs bundles its own (older, non-generic) Buffer type, which TS sees
  // as structurally incompatible with @types/node's current generic Buffer —
  // same value at runtime, just a type-decl mismatch between the two.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], invalid: ["The file has no worksheet."] };
  }

  const headerRow = sheet.getRow(1);
  let emailCol = -1;
  let nameCol = -1;
  headerRow.eachCell((cell, colNumber) => {
    const header = cellText(cell.value).toLowerCase();
    if (emailCol === -1 && /e-?mail/.test(header)) emailCol = colNumber;
    if (nameCol === -1 && /name|company/.test(header)) nameCol = colNumber;
  });

  if (emailCol === -1 || nameCol === -1) {
    return {
      rows: [],
      invalid: [
        "Could not find both an email column and a name column in the first row — make sure the header row has a column with \"email\" in it and one with \"name\" or \"company\" in it.",
      ],
    };
  }

  const rows: ParsedRecipientRow[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const emailRaw = cellText(row.getCell(emailCol).value).trim();
    const nameRaw = cellText(row.getCell(nameCol).value).trim();
    if (!emailRaw && !nameRaw) continue;

    const email = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      invalid.push(`Row ${r}: invalid or missing email address.`);
      continue;
    }
    if (!nameRaw) {
      invalid.push(`Row ${r} (${email}): missing name — skipped.`);
      continue;
    }
    if (seen.has(email)) {
      invalid.push(`Row ${r} (${email}): duplicate in file — skipped.`);
      continue;
    }
    seen.add(email);
    rows.push({ email, name: nameRaw });
  }

  return { rows, invalid };
}
