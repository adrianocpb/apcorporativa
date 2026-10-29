import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { ForbiddenError } from "@/server/errors";
import { assertPermission } from "@/server/services/guard";
import { AUDIT_ACTION_LABELS } from "@/server/services/audit";
import {
  getCompletionHistory,
  getProgressRows,
  getReportOverview,
  parseReportFilters,
} from "@/server/services/reports";
import { toCsv, type CsvValue } from "@/lib/csv";

const STATUS: Record<string, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
};
const METHOD: Record<string, string> = {
  VIDEO_WATCHED: "Vídeo assistido",
  CONFIRMED: "Leitura confirmada",
  VIEWED: "Aberto",
};
const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Exportação CSV (abre no Excel). Mesmos filtros e permissões das telas de relatório. */
export async function GET(request: Request, { params }: RouteContext<"/api/relatorios/[tipo]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const { tipo } = await params;
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseReportFilters(sp);

  let header: string[];
  let rows: CsvValue[][];
  try {
    if (tipo === "progresso") {
      const data = await getProgressRows(db, user, filters);
      header = ["Pessoa", "E-mail", "Área", "Cargo", "Trilha", "Onboarding", "Situação", "Progresso (%)", "Onde parou", "Atribuída em", "Iniciada em", "Concluída em", "Dias para concluir", "Última atividade"];
      rows = data.map((r) => [
        r.user.name, r.user.email, r.user.department, r.user.jobTitle, r.track.title, r.track.isOnboarding,
        STATUS[r.status], r.percent, r.currentItem?.title, r.assignedAt, r.startedAt, r.completedAt, round(r.days), r.lastActivityAt,
      ]);
    } else if (tipo === "trilhas") {
      const data = await getReportOverview(db, user, filters);
      header = ["Trilha", "Onboarding", "Atribuídas", "Não iniciadas", "Em andamento", "Concluídas", "Taxa de conclusão (%)", "Mediana de dias para concluir"];
      rows = data.byTrack.map((t) => [t.title, t.isOnboarding, t.enrolled, t.notStarted, t.inProgress, t.completed, t.rate, round(t.medianDays)]);
    } else if (tipo === "historico") {
      const data = await getCompletionHistory(db, user, filters);
      header = ["Data", "Pessoa", "E-mail", "Área", "Conteúdo", "Versão", "Trilha", "Como foi concluído"];
      rows = data.map((h) => [h.completedAt, h.user.name, h.user.email, h.user.department, h.content.title, h.contentVersion.number, h.track?.title, METHOD[h.method]]);
    } else if (tipo === "auditoria") {
      assertPermission(user, PERMISSIONS.AUDITORIA_VER);
      const action = sp.acao && sp.acao in AUDIT_ACTION_LABELS ? sp.acao : undefined;
      const logs = await db.auditLog.findMany({
        where: action ? { action } : {},
        orderBy: { createdAt: "desc" },
        take: 20000,
        include: { actor: { select: { name: true } } },
      });
      header = ["Data", "Ação", "Responsável", "Tipo", "Registro", "Detalhes", "IP"];
      rows = logs.map((l) => [l.createdAt, AUDIT_ACTION_LABELS[l.action] ?? l.action, l.actor?.name ?? "Sistema", l.entityType, l.entityId, l.details ? JSON.stringify(l.details) : null, l.ip]);
    } else {
      return new Response("Relatório não encontrado.", { status: 404 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Sem permissão.", { status: 403 });
    throw error;
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${tipo}-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
