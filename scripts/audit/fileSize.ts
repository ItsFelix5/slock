import { isSource, lineCount } from "./files";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["file-size"];

const MIN_LINES = 15;
const MAX_LINES = 300;

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    const source = isSource(file);
    if (!(source || file.ext === ".css")) continue;
    const lines = lineCount(file.text);
    const message =
      lines > MAX_LINES
        ? `${lines} lines, over ${MAX_LINES}: split by responsibility`
        : source && lines < MIN_LINES
          ? `${lines} lines, under ${MIN_LINES}: merge into its neighbor`
          : undefined;
    if (message) found.push({ rule: "file-size", path: file.path, line: 1, message });
  }
  return found;
}

export const fileSizeRule: Rule = { group: "size", ids, check };
