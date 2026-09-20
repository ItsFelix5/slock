export type TextIndex = { starts: { node: Node; start: number }[]; text: string };

export function indexElementText(root: Node): TextIndex {
  const starts: TextIndex["starts"] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    starts.push({ node, start: text.length });
    text += node.textContent ?? "";
  }
  return { starts, text: text.toLowerCase() };
}

function pointAt(starts: TextIndex["starts"], index: number) {
  let point: { node: Node; offset: number } | undefined;
  for (const entry of starts) {
    if (entry.start > index) break;
    point = { node: entry.node, offset: index - entry.start };
  }
  return point;
}

export function findTextRanges(index: TextIndex, needle: string): Range[] {
  const term = needle.trim().toLowerCase();
  if (!term) return [];
  const ranges: Range[] = [];
  let at = index.text.indexOf(term);
  while (at !== -1) {
    const start = pointAt(index.starts, at);
    const end = pointAt(index.starts, at + term.length);
    if (start && end) {
      const range = new Range();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      ranges.push(range);
    }
    at = index.text.indexOf(term, at + term.length);
  }
  return ranges;
}
