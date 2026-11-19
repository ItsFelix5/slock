type CssDeclaration = { line: number; property: string; value: string; selector: string };
type CssSelector = { line: number; text: string };
type ParsedCss = { declarations: CssDeclaration[]; selectors: CssSelector[] };

export function parseCss(text: string): ParsedCss {
  const declarations: CssDeclaration[] = [];
  const selectors: CssSelector[] = [];
  let chunk = "";
  let chunkLine = 0;
  let line = 1;
  let depth = 0;
  let quote = "";
  const open: string[] = [];
  const flush = (terminator: string) => {
    const trimmed = chunk.trim();
    chunk = "";
    if (!trimmed) return;
    if (terminator === "{") {
      selectors.push({ line: chunkLine, text: trimmed });
      open.push(trimmed);
      return;
    }
    const colon = trimmed.indexOf(":");
    if (colon > 0 && !trimmed.startsWith("@")) {
      declarations.push({
        line: chunkLine,
        property: trimmed.slice(0, colon).trim(),
        value: trimmed.slice(colon + 1).trim(),
        selector: open.at(-1) ?? "",
      });
    }
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? "";
    if (char === "\n") line++;
    if (!quote && char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      line += text.slice(index, stop).split("\n").length - 1;
      index = stop - 1;
      continue;
    }
    if (quote) {
      if (char === "\\") {
        chunk += char + (text[index + 1] ?? "");
        index++;
        continue;
      }
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (depth === 0 && (char === "{" || char === ";" || char === "}")) {
      flush(char);
      if (char === "}") open.pop();
      continue;
    }
    if (chunk.trim() === "" && char.trim() !== "") chunkLine = line;
    chunk += char;
  }
  flush(";");
  return { declarations, selectors };
}

export function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of selector) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}
