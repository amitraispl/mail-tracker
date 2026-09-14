/** Minimal RFC 4180 CSV serializer — quotes a field only when it contains a
 *  comma, quote, or newline, doubling any embedded quotes. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
