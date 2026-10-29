// Geração de CSV para abrir direto no Excel em português: separador ";", BOM UTF-8 e
// proteção contra injeção de fórmulas (células que começam com = + - @ viram texto).

import { formatDateTime } from "@/lib/format";

export type CsvValue = string | number | boolean | Date | null | undefined;

function cell(value: CsvValue) {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? formatDateTime(value)
      : typeof value === "number"
        ? String(value).replace(".", ",")
        : typeof value === "boolean"
          ? value
            ? "Sim"
            : "Não"
          : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
