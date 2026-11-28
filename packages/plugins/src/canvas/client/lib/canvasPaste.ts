import { safeUrl } from "@slock/blockkit";
import Quill, { filterPastes } from "@slock/ui/editor/quill";
import { TABLE_EMBED } from "./canvasEmbedValues";
import { tableValue } from "./canvasFormatting";

const Delta = Quill.import("delta");

// Diff colours belong to the history view, and unknown tags and comments only to canvas text.
export function pasteCanvasContent(quill: Quill, movesAnnotation: (id: string) => boolean) {
  filterPastes(quill, (pasted, from) => {
    const ops = pasted.ops.map((op) => {
      if (!op.attributes) return op;
      const { annotation, diff, diffmark, htmltags, ...attributes } = op.attributes;
      if (from === "editor" && htmltags !== undefined) attributes.htmltags = htmltags;
      const moved =
        typeof annotation === "string" && annotation.split(" ").filter(movesAnnotation).join(" ");
      if (moved) attributes.annotation = moved;
      return { ...op, attributes };
    });
    return new Delta(ops);
  });
}

export function pasteImageLinks(quill: Quill) {
  quill.clipboard.addMatcher("img", (node, delta) => {
    if (delta.length() > 0 || !(node instanceof HTMLImageElement)) return delta;
    const source = safeUrl(node.getAttribute("src") ?? "");
    if (!source) return new Delta().insert(node.alt);
    return new Delta().insert(node.alt || source, { link: source });
  });
}

// Quill has no table format, so pasted tables would otherwise flatten into loose lines.
export function pasteTables(quill: Quill, newId: () => string) {
  if (!quill.scroll.query(TABLE_EMBED)) return;
  quill.clipboard.addMatcher("table", (node, delta) => {
    if (!(node instanceof HTMLTableElement)) return delta;
    const rows = [...node.rows];
    const columns = Math.max(0, ...rows.map((row) => row.cells.length));
    if (columns === 0) return delta;
    const value = tableValue(newId, { columns, rows: rows.length }, (row, column) => {
      const cell = rows[row]?.cells[column];
      return cell ? quill.clipboard.convert({ html: cell.innerHTML.trim() }).ops : [];
    });
    return new Delta().insert({ [TABLE_EMBED]: value }, { sid: value.id });
  });
}
