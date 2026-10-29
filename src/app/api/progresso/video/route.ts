import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/current-user";
import { AppError, NotFoundError } from "@/server/errors";
import { LockedError, recordVideoHeartbeat } from "@/server/services/learning";

const beatSchema = z.object({
  trackId: z.string().min(1).max(40),
  itemId: z.string().min(1).max(40),
  from: z.number().finite(),
  to: z.number().finite(),
  position: z.number().finite(),
  duration: z.number().finite(),
});

/**
 * Sinal periódico do player (a cada ~10 s, na pausa e ao sair da página).
 * O servidor decide quanto do trecho informado é aceito; o navegador não conclui nada sozinho.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: z.infer<typeof beatSchema>;
  try {
    // Aceita JSON enviado como texto (sendBeacon ao sair da página).
    body = beatSchema.parse(JSON.parse(await request.text()));
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const result = await recordVideoHeartbeat(db, user, body.trackId, body.itemId, body);
    return NextResponse.json({ coverage: result.coverage, completed: result.completed, events: result.events });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof LockedError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[progresso/video]", error);
    return NextResponse.json({ error: "Não foi possível registrar o progresso." }, { status: 500 });
  }
}
