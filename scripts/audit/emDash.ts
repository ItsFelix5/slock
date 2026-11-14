import { preview } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["em-dash"];

const EM_DASH = String.fromCharCode(0x2014);

function check(files: SourceFile[]): Violation[] {
  return files.flatMap((file) =>
    file.text
      .split("\n")
      .flatMap((text, index) =>
        text.includes(EM_DASH)
          ? [{ rule: "em-dash", path: file.path, line: index + 1, message: preview(text) }]
          : [],
      ),
  );
}

export const emDashRule: Rule = { group: "dash", ids, check };
