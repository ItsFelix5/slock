import type Quill from "quill";

const BLOCK_EMBED_KEYS = ["canvasColumns", "canvasFile", "canvasImage", "canvasTable"];

function isEmbedChurn(change: ReturnType<Quill["getContents"]>): boolean {
  let embedInserts = 0;
  let deleted = 0;
  for (const op of change.ops) {
    const { insert } = op;
    if (typeof insert === "string") return false;
    if (insert && BLOCK_EMBED_KEYS.some((key) => key in insert)) embedInserts += 1;
    else if (insert) return false;
    if (typeof op.delete === "number") deleted += op.delete;
  }
  return embedInserts === 1 && deleted === 1;
}

export function ignoreEmbedChurn(quill: Quill) {
  const { history } = quill;
  const record = history.record.bind(history);
  history.record = (change, oldDelta) => {
    if (!isEmbedChurn(change)) record(change, oldDelta);
  };
}
