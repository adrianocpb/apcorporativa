import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MARK_END, MARK_START } from "@/lib/search-marks";

export { MARK_END, MARK_START };

/**
 * Índice de busca textual. É dado derivado (reconstruível a partir do banco principal),
 * por isso fica isolado atrás desta interface:
 * - validação: SQLite FTS5 em arquivo próprio (data/search.db), sem afetar as migrações;
 * - produção com PostgreSQL: implementar com tsvector ('portuguese') + unaccent.
 */
export interface SearchIndex {
  upsert(doc: SearchDocument): void;
  remove(contentId: string): void;
  search(query: string, limit?: number): SearchHit[];
  count(): number;
  clear(): void;
}

export type SearchDocument = { contentId: string; title: string; description: string; body: string };

/** Trecho com o termo encontrado; marcadores \u0001…\u0002 indicam o destaque (sem HTML). */
export type SearchHit = { contentId: string; snippet: string };


/** Converte a busca do usuário em uma consulta FTS5 segura (cada termo entre aspas, com prefixo). */
export function toFtsQuery(input: string) {
  const terms = input
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 12);
  return terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(" ");
}

export class SqliteSearchIndex implements SearchIndex {
  private db: Database.Database;

  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    // remove_diacritics 2: "configuracao" encontra "configuração".
    this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
      contentId UNINDEXED, title, description, body,
      tokenize = "unicode61 remove_diacritics 2"
    )`);
  }

  upsert(doc: SearchDocument) {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM docs WHERE contentId = ?").run(doc.contentId);
      this.db
        .prepare("INSERT INTO docs (contentId, title, description, body) VALUES (?, ?, ?, ?)")
        .run(doc.contentId, doc.title, doc.description, doc.body);
    });
    tx();
  }

  remove(contentId: string) {
    this.db.prepare("DELETE FROM docs WHERE contentId = ?").run(contentId);
  }

  search(query: string, limit = 200): SearchHit[] {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    // Pesos: título vale mais que descrição, que vale mais que o corpo.
    return this.db
      .prepare(
        `SELECT contentId,
                snippet(docs, -1, ?, ?, '…', 14) AS snippet
           FROM docs
          WHERE docs MATCH ?
          ORDER BY bm25(docs, 0, 10, 4, 1)
          LIMIT ?`,
      )
      .all(MARK_START, MARK_END, fts, limit) as SearchHit[];
  }

  count() {
    return (this.db.prepare("SELECT count(*) AS n FROM docs").get() as { n: number }).n;
  }

  clear() {
    this.db.exec("DELETE FROM docs");
  }
}

let index: SearchIndex | undefined;

export function getSearchIndex(): SearchIndex {
  index ??= new SqliteSearchIndex(
    process.env.SEARCH_DB === ":memory:"
      ? ":memory:"
      : path.resolve(/*turbopackIgnore: true*/ process.env.SEARCH_DB ?? "data/search.db"),
  );
  return index;
}
