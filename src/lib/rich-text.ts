// Converte o documento do editor (JSON do Tiptap) em HTML usando uma lista fechada de
// elementos e atributos. Tudo que não está na lista é descartado e todo texto é escapado,
// então o resultado é seguro para exibir sem outra sanitização.

export type RichNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export const FILE_SRC_PATTERN = /^\/api\/arquivos\/([a-z0-9]{20,40})$/;

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aceita http(s), mailto e caminhos internos. Recusa javascript:, data: etc. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function attrString(value: unknown, max = 300) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cellSpan(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 && n <= 20 ? n : null;
}

type Output = { text: string[]; imageFileIds: Set<string> };

function renderMarks(text: string, marks: RichNode["marks"]) {
  let html = escape(text);
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (!href) break;
        const external = !href.startsWith("/");
        html = `<a href="${escape(href)}"${
          external ? ' target="_blank" rel="noopener noreferrer"' : ""
        }>${html}</a>`;
        break;
      }
    }
  }
  return html;
}

function renderChildren(node: RichNode, out: Output) {
  return (node.content ?? []).map((child) => renderNode(child, out)).join("");
}

function block(node: RichNode, out: Output, tag: string) {
  const inner = renderChildren(node, out);
  out.text.push("\n");
  return `<${tag}>${inner}</${tag}>`;
}

function renderNode(node: RichNode, out: Output): string {
  switch (node.type) {
    case "doc":
      return renderChildren(node, out);
    case "text": {
      const text = typeof node.text === "string" ? node.text : "";
      out.text.push(text);
      return renderMarks(text, node.marks);
    }
    case "paragraph":
      return block(node, out, "p");
    case "heading":
      return block(node, out, node.attrs?.level === 3 ? "h3" : "h2");
    case "blockquote":
      return block(node, out, "blockquote");
    case "bulletList":
      return block(node, out, "ul");
    case "orderedList": {
      const start = Number(node.attrs?.start);
      const inner = renderChildren(node, out);
      return Number.isInteger(start) && start > 1 && start < 10000
        ? `<ol start="${start}">${inner}</ol>`
        : `<ol>${inner}</ol>`;
    }
    case "listItem":
      return block(node, out, "li");
    case "hardBreak":
      out.text.push("\n");
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const src = attrString(node.attrs?.src, 100);
      const match = FILE_SRC_PATTERN.exec(src);
      if (!match) return ""; // só imagens enviadas para a própria plataforma
      out.imageFileIds.add(match[1]);
      const alt = attrString(node.attrs?.alt);
      const caption = attrString(node.attrs?.title);
      if (caption) out.text.push(` ${caption} `);
      const img = `<img src="${escape(src)}" alt="${escape(alt)}" loading="lazy">`;
      return caption
        ? `<figure>${img}<figcaption>${escape(caption)}</figcaption></figure>`
        : `<figure>${img}</figure>`;
    }
    case "table":
      return `<div class="table-wrap"><table><tbody>${renderChildren(node, out)}</tbody></table></div>`;
    case "tableRow":
      return `<tr>${renderChildren(node, out)}</tr>`;
    case "tableHeader":
    case "tableCell": {
      const tag = node.type === "tableHeader" ? "th" : "td";
      const colspan = cellSpan(node.attrs?.colspan);
      const rowspan = cellSpan(node.attrs?.rowspan);
      const attrs = `${colspan ? ` colspan="${colspan}"` : ""}${rowspan ? ` rowspan="${rowspan}"` : ""}`;
      out.text.push(" ");
      return `<${tag}${attrs}>${renderChildren(node, out)}</${tag}>`;
    }
    default:
      // Elemento desconhecido: mantém apenas o conteúdo interno.
      return renderChildren(node, out);
  }
}

export function renderRichText(doc: RichNode) {
  const out: Output = { text: [], imageFileIds: new Set() };
  const html = renderNode(doc, out);
  const text = out.text.join("").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  return { html, text, imageFileIds: [...out.imageFileIds] };
}

export const EMPTY_DOC: RichNode = { type: "doc", content: [{ type: "paragraph" }] };
