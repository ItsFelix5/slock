import type Quill from "quill";

const DEPTHS = 2;

function pathOf(node: Node): string[] {
  return node instanceof HTMLElement && node.dataset.layout ? node.dataset.layout.split("/") : [];
}

function edges(paths: string[][], index: number, depth: number): string {
  const own = paths[index]?.slice(0, depth + 1).join("/") ?? "";
  if (!own) return "";
  const at = (offset: number) => paths[index + offset]?.slice(0, depth + 1).join("/") ?? "";
  const tokens = [at(-1) === own ? "mid" : "first", at(1) === own ? "" : "last"];
  return tokens.filter(Boolean).join(" ");
}

export function decorateLayouts(quill: Quill) {
  const lines = quill.getLines();
  const paths = lines.map((line) => pathOf(line.domNode));
  lines.forEach((line, index) => {
    const node = line.domNode;
    if (!(node instanceof HTMLElement)) return;
    for (let depth = 0; depth < DEPTHS; depth++) {
      const kind = paths[index]?.[depth]?.split(":")[0] ?? "";
      const edge = edges(paths, index, depth);
      if (node.dataset[`f${depth}`] !== (kind || undefined)) {
        if (kind) node.dataset[`f${depth}`] = kind;
        else delete node.dataset[`f${depth}`];
      }
      if (node.dataset[`e${depth}`] !== (edge || undefined)) {
        if (edge) node.dataset[`e${depth}`] = edge;
        else delete node.dataset[`e${depth}`];
      }
    }
  });
}

export function scheduleDecorations(quill: Quill): () => void {
  let frame = 0;
  const run = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => decorateLayouts(quill));
  };
  quill.on("text-change", run);
  run();
  return () => {
    cancelAnimationFrame(frame);
    quill.off("text-change", run);
  };
}
