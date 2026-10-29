import { describe, expect, it } from "vitest";
import { db, makeActor, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import {
  createCategory,
  listCategoryOptions,
  listCategoryTree,
  moveCategory,
  setCategoryArchived,
  updateCategory,
} from "@/server/services/categories";

setupTestDb();

const input = (name: string, parentId = "") => ({ name, description: "", parentId });

describe("categorias", () => {
  it("monta a árvore em dois níveis e as opções com caminho", async () => {
    const admin = await makeActor();
    const sistemas = await createCategory(db, admin, input("Sistemas e plataformas"));
    await createCategory(db, admin, input("Financeiro"));
    const erp = await createCategory(db, admin, input("ERP", sistemas.id));
    await expect(createCategory(db, admin, input("Módulo", erp.id))).rejects.toThrow(/dois níveis/);

    const tree = await listCategoryTree(db, admin);
    expect(tree.map((c) => c.name)).toEqual(["Sistemas e plataformas", "Financeiro"]);
    expect(tree[0].children.map((c) => c.name)).toEqual(["ERP"]);
    expect((await listCategoryOptions(db, admin)).map((o) => o.label)).toEqual([
      "Sistemas e plataformas",
      "Sistemas e plataformas › ERP",
      "Financeiro",
    ]);
  });

  it("recusa nome repetido no mesmo nível e permite em níveis diferentes", async () => {
    const admin = await makeActor();
    const a = await createCategory(db, admin, input("Processos"));
    await expect(createCategory(db, admin, input("Processos"))).rejects.toMatchObject({
      fieldErrors: { name: expect.any(String) },
    });
    await createCategory(db, admin, input("Processos", a.id));
  });

  it("reordena entre irmãos", async () => {
    const admin = await makeActor();
    await createCategory(db, admin, input("Alfa"));
    const b = await createCategory(db, admin, input("Beta"));
    await moveCategory(db, admin, b.id, "up");
    expect((await listCategoryTree(db, admin)).map((c) => c.name)).toEqual(["Beta", "Alfa"]);
    await moveCategory(db, admin, b.id, "up"); // já é o primeiro: nada muda
    expect((await listCategoryTree(db, admin)).map((c) => c.name)).toEqual(["Beta", "Alfa"]);
  });

  it("arquiva respeitando a hierarquia e some das opções", async () => {
    const admin = await makeActor();
    const pai = await createCategory(db, admin, input("RH"));
    const filho = await createCategory(db, admin, input("Benefícios", pai.id));
    await expect(setCategoryArchived(db, admin, pai.id, true)).rejects.toThrow(/subcategorias/);
    await setCategoryArchived(db, admin, filho.id, true);
    await setCategoryArchived(db, admin, pai.id, true);
    expect(await listCategoryOptions(db, admin)).toEqual([]);
    await expect(setCategoryArchived(db, admin, filho.id, false)).rejects.toThrow(/principal/);
  });

  it("categoria com subcategorias não vira subcategoria", async () => {
    const admin = await makeActor();
    const a = await createCategory(db, admin, input("Alfa"));
    const b = await createCategory(db, admin, input("Beta"));
    await createCategory(db, admin, input("Alfa 1", a.id));
    await expect(updateCategory(db, admin, a.id, input("Alfa", b.id))).rejects.toThrow(/subcategorias/);
  });

  it("colaborador não gerencia categorias", async () => {
    const colaborador = await makeActor("COLABORADOR");
    await expect(createCategory(db, colaborador, input("X"))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listCategoryTree(db, colaborador)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
