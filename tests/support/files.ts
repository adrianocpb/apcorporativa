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

function box(type: string, ...payload: Buffer[]) {
  const body = Buffer.concat(payload);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

/** MP4 mínimo (ftyp + mdat + moov/mvhd) com a duração indicada. Não é reproduzível. */
export function makeMp4(durationSeconds: number) {
  const ftyp = box("ftyp", Buffer.from("isom"), Buffer.from([0, 0, 2, 0]), Buffer.from("isomiso2mp41"));
  const mdat = box("mdat", Buffer.alloc(5000));
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12); // timescale
  mvhd.writeUInt32BE(Math.round(durationSeconds * 1000), 16); // duração
  const moov = box("moov", box("mvhd", mvhd));
  return Uint8Array.from(Buffer.concat([ftyp, mdat, moov]));
}
