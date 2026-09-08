import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<Row> {
  /** Stable key for this column. */
  key: string;
  header: ReactNode;
  /** Cell renderer; defaults to nothing, so always provide one. */
  cell: (row: Row, index: number) => ReactNode;
  align?: "left" | "right";
  /** Render the cell in JetBrains Mono (tokens, URLs, counts). */
  mono?: boolean;
  width?: string;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Shown in place of the body when there are no rows. */
  empty?: ReactNode;
  caption?: ReactNode;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty = "No data yet.",
  caption,
}: DataTableProps<Row>) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {caption && <caption className={styles.caption}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`${styles.th} ${col.align === "right" ? styles.right : styles.left}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className={styles.row}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    data-label={typeof col.header === "string" ? col.header : undefined}
                    className={[
                      styles.td,
                      col.align === "right" ? styles.right : styles.left,
                      col.mono ? styles.mono : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
