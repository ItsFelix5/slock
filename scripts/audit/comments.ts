import { isSource } from "./files";
import { classifyComment, commentsOf, preview } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["comment"];

function check(files: SourceFile[]): Violation[] {
  return files.filter(isSource).flatMap((file) =>
    commentsOf(file)
      .filter((comment) => classifyComment(comment.text) === "plain")
      .map((comment) => ({
        rule: "comment",
        path: file.path,
        line: comment.line,
        message: preview(comment.text),
      })),
  );
}

export const commentsRule: Rule = { group: "comment", ids, check };
