import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Armazenamento de arquivos. Em desenvolvimento/validação: disco local.
 * Em produção com várias instâncias: implementar esta mesma interface sobre um
 * armazenamento de objetos S3-compatível (ver docs/ARQUITETURA.md).
 */
export interface StorageProvider {
  /** Grava um novo objeto. Falha se a chave já existir (nunca sobrescreve). */
  write(key: string, source: AsyncIterable<Uint8Array>): Promise<void>;
  read(key: string, range?: { start: number; end: number }): Readable;
  /** Lê um trecho pequeno (ex.: cabeçalhos de vídeo). */
  readBytes(key: string, start: number, length: number): Promise<Buffer>;
  size(key: string): Promise<number>;
  remove(key: string): Promise<void>;
}

export class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    // Impede que uma chave malformada escape da pasta de armazenamento.
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error("Chave de armazenamento inválida.");
    }
    return full;
  }

  async write(key: string, source: AsyncIterable<Uint8Array>) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    const exists = await stat(target).then(
      () => true,
      () => false,
    );
    if (exists) throw new Error("Arquivo já existe no armazenamento.");
    const partial = `${target}.parcial`;
    try {
      await pipeline(source, createWriteStream(partial, { flags: "wx" }));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
  }

  read(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.resolve(key), range);
  }

  async readBytes(key: string, start: number, length: number) {
    const handle = await open(this.resolve(key), "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async size(key: string) {
    return (await stat(this.resolve(key))).size;
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

let storage: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  // Pasta de dados em tempo de execução: não deve entrar no rastreamento do build.
  storage ??= new LocalDiskStorage(
    path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "storage"),
  );
  return storage;
}
