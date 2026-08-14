export interface LinkShortcutMatch {
  start: number;
  end: number;
  text: string;
  url: string;
}

const LINK_RE = /\[([^[\]]+)\]\(([^\s()]+)\)$/;

/** A just-completed `[text](url)` span ending exactly at `caretOffset` — mirrors
 * `detectMarkShortcut`'s shape, fires right after the closing `)` is typed. */
export function detectLinkShortcut(text: string, caretOffset: number): LinkShortcutMatch | null {
  const before = text.slice(0, caretOffset);
  const match = LINK_RE.exec(before);
  if (!match) return null;
  const [whole, label, url] = match;
  return { end: caretOffset, start: caretOffset - whole.length, text: label, url };
}

export const URL_RE = /^https?:\/\/\S+$/;
