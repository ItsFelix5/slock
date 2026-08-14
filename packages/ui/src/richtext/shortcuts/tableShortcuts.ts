const PIPE_ROW_RE = /^\|(.+)\|$/;
const PIPE_SEPARATOR_RE = /^\|(\s*:?-+:?\s*\|)+$/;

/** A typed `| a | b |` row's cell texts, or null if `text` isn't shaped like one. */
export function parsePipeRow(text: string): string[] | null {
  const match = PIPE_ROW_RE.exec(text.trim());
  return match ? match[1].split("|").map((c) => c.trim()) : null;
}

/** A typed `| --- | --- |` divider row — completing this line right after a pipe-row is the
 * table trigger (mirrors blockkit's `pipeTable.ts`, which detects the same shape on the way
 * back in from a sent message, but this is the in-editor structural conversion, not text parsing). */
export function isPipeSeparatorRow(text: string): boolean {
  return PIPE_SEPARATOR_RE.test(text.trim());
}
