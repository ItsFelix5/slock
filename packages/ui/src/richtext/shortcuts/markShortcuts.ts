import type { Mark } from "../docModel";

export interface MarkShortcutMatch {
  start: number;
  end: number;
  mark: Mark;
  text: string;
}

// Mirrors blockkit's real Slack mrkdwn dialect (single-delimiter `*bold*`/`_italic_`/`~strike~`/
// `` `code` ``, with `**bold**` also accepted since it's an extremely common typing habit and
// blockkit's own parser already treats double- and single-star identically). Each pattern's
// match[0] is exactly the delimited span (lookbehind/lookahead keep guard chars out of it) so
// `start`/`end` bound precisely what gets replaced.
const PATTERNS: { mark: Mark; re: RegExp }[] = [
  { mark: "code", re: /`([^`]+)`$/ },
  { mark: "bold", re: /\*\*([^*\s][^*]*)\*\*$/ },
  { mark: "bold", re: /(?<![\w*])\*([^*\s][^*]*)\*$/ },
  { mark: "italic", re: /(?<![\w_])_([^_\s][^_]*)_$/ },
  { mark: "strike", re: /(?<![\w~])~([^~\s][^~]*)~$/ },
];

/** Looks for a just-completed `*bold*`-style span ending exactly at `caretOffset` in a single
 * run-container's flat text. Pure — the caller (EditorView, on input) turns a match into a
 * `replaceTriggerRange(match.start, textRun(match.text, [...marks, match.mark]))` call. */
export function detectMarkShortcut(text: string, caretOffset: number): MarkShortcutMatch | null {
  const before = text.slice(0, caretOffset);
  for (const { mark, re } of PATTERNS) {
    const match = re.exec(before);
    if (!match) continue;
    const [whole, inner] = match;
    const start = caretOffset - whole.length;
    return { end: caretOffset, mark, start, text: inner };
  }
  return null;
}
