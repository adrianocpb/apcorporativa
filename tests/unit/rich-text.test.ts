import { describe, expect, it } from "vitest";
import { renderRichText, safeHref, type RichNode } from "@/lib/rich-text";

const doc = (...content: RichNode[]): RichNode => ({ type: "doc", content });
const p = (...content: RichNode[]): RichNode => ({ type: "paragraph", content });
const t = (text: string, marks?: RichNode["marks"]): RichNode => ({ type: "text", text, marks });

describe("renderização do editor", () => {
  it("gera títulos, listas e marcas permitidas", () => {
    const { html, text } = renderRichText(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [t("Acesso ao ERP")] },
        p(t("Use "), t("sempre", [{ type: "bold" }]), t(" o login.")),
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("Passo 1"))] }] },
      ),
    );
    expect(html).toBe(
      "<h2>Acesso ao ERP</h2><p>Use <strong>sempre</strong> o login.</p><ul><li><p>Passo 1</p></li></ul>",
    );
    expect(text).toContain("Acesso ao ERP");
    expect(text).toContain("Passo 1");
  });

  it("escapa texto e descarta elementos desconhecidos", () => {
    const { html } = renderRichText(
      doc(p(t('<script>alert("x")</script>')), { type: "iframe", content: [p(t("dentro"))] }),
    );
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("iframe");
    expect(html).toContain("<p>dentro</p>");
  });

  it("recusa links perigosos e abre externos em nova aba com segurança", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    const { html } = renderRichText(
      doc(
        p(t("mau", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
        p(t("bom", [{ type: "link", attrs: { href: "https://empresa.com/x" } }])),
      ),
    );
    expect(html).toContain("<p>mau</p>");
    expect(html).toContain('<a href="https://empresa.com/x" target="_blank" rel="noopener noreferrer">bom</a>');
  });

  it("aceita só imagens da própria plataforma e registra quais são", () => {
    const id = "cmabcdefghijklmnopqrstu";
    const { html, imageFileIds } = renderRichText(
      doc(
        { type: "image", attrs: { src: `/api/arquivos/${id}`, alt: "Tela", title: "Figura 1" } },
        { type: "image", attrs: { src: "https://outro.site/x.png" } },
        { type: "image", attrs: { src: `/api/arquivos/${id}" onerror="x` } },
      ),
    );
    expect(imageFileIds).toEqual([id]);
    expect(html).toBe(
      `<figure><img src="/api/arquivos/${id}" alt="Tela" loading="lazy"><figcaption>Figura 1</figcaption></figure>`,
    );
  });

  it("renderiza tabelas com mesclagem limitada", () => {
    const { html } = renderRichText(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", attrs: { colspan: 2 }, content: [p(t("Campo"))] },
              { type: "tableCell", attrs: { colspan: 999 }, content: [p(t("Valor"))] },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('<th colspan="2"><p>Campo</p></th>');
    expect(html).toContain("<td><p>Valor</p></td>");
  });
});
