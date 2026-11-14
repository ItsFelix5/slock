import ts from "typescript";
import { isSource } from "./files";
import { classifyComment, commentsOf, lineOf, parse, preview, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["console", "cast", "non-null", "any", "suppress", "todo"];

const LEFTOVER_CONSOLE = new Set(["log", "debug", "info", "trace", "dir", "table"]);

function inspectNode(file: SourceFile, tree: ts.SourceFile, node: ts.Node): Violation | undefined {
  const at = (rule: string, message: string): Violation => ({
    rule,
    path: file.path,
    line: lineOf(tree, node),
    message,
  });
  if (node.kind === ts.SyntaxKind.AnyKeyword) return at("any", "any type");
  if (ts.isNonNullExpression(node)) return at("non-null", `non-null assertion ${node.getText()}`);
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    const isConst = ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === "const";
    return isConst ? undefined : at("cast", `cast to ${node.type.getText()}`);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "console" &&
    file.area !== "scripts" &&
    LEFTOVER_CONSOLE.has(node.expression.name.text)
  ) {
    return at("console", `console.${node.expression.name.text}`);
  }
}

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (!isSource(file)) continue;
    const tree = parse(file);
    visit(tree, (node) => {
      const hit = inspectNode(file, tree, node);
      if (hit) found.push(hit);
    });
    for (const comment of commentsOf(file)) {
      const kind = classifyComment(comment.text);
      if (kind === "suppress" || kind === "todo") {
        found.push({
          rule: kind,
          path: file.path,
          line: comment.line,
          message: preview(comment.text),
        });
      }
    }
  }
  return found;
}

export const smellsRule: Rule = { group: "smell", ids, check };
