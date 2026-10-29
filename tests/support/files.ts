import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalDiskStorage } from "@/server/storage/storage";

/** Armazenamento isolado em pasta temporária para cada arquivo de teste. */
export function tempStorage() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "apc-storage-"));
  return { dir, storage: new LocalDiskStorage(dir) };
}

export async function* streamOf(...parts: (Uint8Array | string)[]) {
  for (const p of parts) yield typeof p === "string" ? new TextEncoder().encode(p) : p;
}

export const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n",
);

// PNG 1x1 válido.
export const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
);
