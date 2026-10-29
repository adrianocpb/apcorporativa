import { createHash, randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { FileKind } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { getStorage, type StorageProvider } from "@/server/storage/storage";
import { assertPermission } from "@/server/services/guard";
import { FILE_RULES, formatBytes } from "@/lib/file-rules";

const HEADER_BYTES = 4100; // suficiente para identificar o tipo pelo conteúdo

export function sanitizeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim().slice(0, 200);
  return clean || "arquivo";
}

function concat(chunks: Uint8Array[], total: number) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export type UploadInput = {
  kind: FileKind;
  originalName: string;
  stream: AsyncIterable<Uint8Array>;
};

/**
 * Recebe um arquivo em fluxo (sem carregá-lo inteiro na memória), confere o tipo real
 * pelo conteúdo (não pela extensão), aplica o limite de tamanho, calcula o SHA-256 e
 * grava com nome interno aleatório.
 */
export async function storeUpload(
  db: Db,
  actor: SessionUser,
  input: UploadInput,
  options: { storage?: StorageProvider; maxBytes?: number } = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const rules = FILE_RULES[input.kind];
  if (!rules) throw new AppError("Tipo de arquivo inválido.");
  const maxBytes = options.maxBytes ?? rules.maxBytes;
  const storage = options.storage ?? getStorage();
  const tooLarge = () =>
    new AppError(`Arquivo maior que o permitido para ${rules.label} (${formatBytes(maxBytes)}).`);

  const iterator = input.stream[Symbol.asyncIterator]();
  const head: Uint8Array[] = [];
  let headSize = 0;
  let ended = false;
  while (headSize < HEADER_BYTES) {
    const next = await iterator.next();
    if (next.done) {
      ended = true;
      break;
    }
    head.push(next.value);
    headSize += next.value.length;
  }
  if (headSize === 0) throw new AppError("O arquivo está vazio.");
  if (headSize > maxBytes) throw tooLarge();

  const headBuffer = concat(head, headSize);
  const detected = await fileTypeFromBuffer(headBuffer);
  const extension = detected ? rules.mimes[detected.mime] : undefined;
  if (!detected || !extension) {
    throw new AppError(`Formato não permitido. Envie ${rules.formats}.`);
  }

  const hash = createHash("sha256");
  let size = 0;
  async function* body() {
    hash.update(headBuffer);
    size = headSize;
    yield headBuffer;
    if (ended) return;
    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      size += next.value.length;
      if (size > maxBytes) throw tooLarge();
      hash.update(next.value);
      yield next.value;
    }
  }

  const now = new Date();
  const storageKey = `${input.kind.toLowerCase()}/${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}/${randomUUID()}.${extension}`;

  try {
    await storage.write(storageKey, body());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Não foi possível gravar o arquivo. Tente novamente.");
  }

  try {
    return await db.storedFile.create({
      data: {
        storageKey,
        originalName: sanitizeFileName(input.originalName),
        mimeType: detected.mime,
        kind: input.kind,
        size,
        sha256: hash.digest("hex"),
        uploadedById: actor.id,
      },
    });
  } catch (error) {
    await storage.remove(storageKey);
    throw error;
  }
}

/**
 * Decide se o usuário pode ler o arquivo. Quem gerencia conteúdos vê qualquer arquivo;
 * os demais, apenas arquivos da versão vigente de um conteúdo publicado.
 * Arquivo inexistente e arquivo sem acesso respondem igual (não revela existência).
 */
export async function authorizeFileRead(db: Db, user: SessionUser, fileId: string) {
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) throw new NotFoundError("Arquivo não encontrado.");
  if (hasPermission(user, PERMISSIONS.CONTEUDOS_GERENCIAR)) return file;

  const published = { currentOf: { is: { status: "PUBLISHED" as const } } };
  const reachable = await db.contentVersion.count({
    where: {
      ...published,
      OR: [{ fileId }, { assets: { some: { fileId } } }],
    },
  });
  if (reachable === 0) throw new NotFoundError("Arquivo não encontrado.");
  return file;
}
