// Minimal CSV writer for the history/statistics export. Semicolon-separated
// with a UTF-8 BOM, which is what Excel with a Russian locale opens directly
// (Google Sheets and LibreOffice detect it too).
const SEP = ";";

// Cells starting with = + - @ (or tab/CR) would be run as formulas by
// spreadsheet apps — player names come from other club members, so they
// are neutralised with a leading apostrophe.
function cell(value) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvTable(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers, ...rows.map((r) => headers.map((h) => r[h]))].map((line) => line.map(cell).join(SEP)).join("\r\n");
}

// Several titled tables in one file, separated by an empty line.
export function buildCsv(sections) {
  return (
    "﻿" +
    sections
      .filter((s) => s.rows.length)
      .map((s) => `${cell(s.title)}\r\n${toCsvTable(s.rows)}`)
      .join("\r\n\r\n") +
    "\r\n"
  );
}
