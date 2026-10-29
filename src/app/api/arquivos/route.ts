import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";
import { storeUpload } from "@/server/services/files";
import type { FileKind } from "@/generated/prisma/client";

const KINDS: FileKind[] = ["VIDEO", "PDF", "IMAGE"];

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Upload em fluxo: o corpo da requisição é o próprio arquivo (sem multipart), o que permite
 * vídeos grandes sem carregá-los na memória. Fica fora do proxy para não ser bufferizado.
 */
export async function POST(request: Request) {
  // Proteção contra requisições de outros sites (CSRF): exige mesma origem.
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const kind = new URL(request.url).searchParams.get("tipo") as FileKind | null;
  if (!kind || !KINDS.includes(kind) || !request.body) {
    return NextResponse.json({ error: "Requisição de envio inválida." }, { status: 400 });
  }

  let name = "arquivo";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "arquivo");
  } catch {
    // Nome malformado: usa o padrão.
  }

  try {
    const file = await storeUpload(db, user, {
      kind,
      originalName: name,
      stream: request.body as unknown as AsyncIterable<Uint8Array>,
    });
    return NextResponse.json(
      {
        id: file.id,
        name: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        kind: file.kind,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.name === "ForbiddenError" ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[upload]", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o arquivo. Tente novamente." },
      { status: 500 },
    );
  }
}
