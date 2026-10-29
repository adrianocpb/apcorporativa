import { Readable } from "node:stream";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/current-user";
import { NotFoundError } from "@/server/errors";
import { authorizeFileRead } from "@/server/services/files";
import { getStorage } from "@/server/storage/storage";

function parseRange(header: string | null, size: number) {
  const match = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, a, b] = match;
  let start: number;
  let end: number;
  if (a === "") {
    // "bytes=-500": últimos 500 bytes
    start = Math.max(0, size - Number(b));
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (!Number.isFinite(start) || start > end || start >= size) return "invalid" as const;
  return { start, end };
}

/** Entrega o arquivo após checar sessão e permissão. Suporta Range (avançar/retomar vídeo). */
export async function GET(request: Request, { params }: RouteContext<"/api/arquivos/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { id } = await params;
  let file;
  try {
    file = await authorizeFileRead(db, user, id);
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Arquivo não encontrado.", { status: 404 });
    throw error;
  }

  const storage = getStorage();
  let size: number;
  try {
    size = await storage.size(file.storageKey);
  } catch {
    console.error("[arquivos] ausente no armazenamento:", file.id);
    return new Response("Arquivo indisponível.", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
      file.originalName,
    )}`,
  });

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    const stream = storage.read(file.storageKey, range);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(storage.read(file.storageKey)) as ReadableStream, {
    status: 200,
    headers,
  });
}
