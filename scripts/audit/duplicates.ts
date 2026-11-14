import ts from "typescript";
import { isSource } from "./files";
import { type FunctionNode, functionName, isFunctionNode, lineSpan } from "./functions";
import { lineOf, parse, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["duplicate"];

const MIN_LINES = 6;

type Occurrence = { file: SourceFile; line: number; name: string; start: number; end: number };

function declaredNames(node: FunctionNode): Set<string> {
  const names = new Set<string>();
  const collect = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else
      for (const element of name.elements) if (ts.isBindingElement(element)) collect(element.name);
  };
  visit(node, (child) => {
    if (ts.isParameter(child) || ts.isVariableDeclaration(child)) collect(child.name);
    if (ts.isFunctionDeclaration(child) && child.name) names.add(child.name.text);
  });
  return names;
}

function fingerprint(node: FunctionNode): string {
  const local = declaredNames(node);
  const aliases = new Map<string, string>();
  const parts: string[] = [];
  visit(node, (child) => {
    if (ts.isIdentifier(child)) {
      if (!local.has(child.text)) return parts.push(`i:${child.text}`);
      if (!aliases.has(child.text)) aliases.set(child.text, `v${aliases.size}`);
      return parts.push(aliases.get(child.text) ?? "");
    }
    if (ts.isLiteralExpression(child)) return parts.push(`l:${child.text}`);
    parts.push(String(child.kind));
  });
  return parts.join(" ");
}

function check(files: SourceFile[]): Violation[] {
  const groups = new Map<string, Occurrence[]>();
  for (const file of files) {
    if (!isSource(file) || file.isTest) continue;
    const tree = parse(file);
    visit(tree, (node) => {
      if (!(isFunctionNode(node) && node.body) || lineSpan(tree, node) < MIN_LINES) return;
      const key = fingerprint(node);
      const list = groups.get(key) ?? [];
      list.push({
        file,
        line: lineOf(tree, node),
        name: functionName(node),
        start: node.getStart(tree),
        end: node.getEnd(),
      });
      groups.set(key, list);
    });
  }
  const repeated = [...groups.values()].filter((list) => list.length > 1);
  const everyRepeat = repeated.flat();
  const isNested = (inner: Occurrence) =>
    everyRepeat.some(
      (outer) =>
        outer !== inner &&
        outer.file === inner.file &&
        outer.start <= inner.start &&
        inner.end <= outer.end &&
        outer.end - outer.start > inner.end - inner.start,
    );
  return repeated.flatMap((list) =>
    list.flatMap((occurrence) => {
      const first = list.find((other) => other !== occurrence);
      if (!first || isNested(occurrence)) return [];
      const more = list.length > 2 ? ` and ${list.length - 2} more` : "";
      return [
        {
          rule: "duplicate",
          path: occurrence.file.path,
          line: occurrence.line,
          message: `${occurrence.name} duplicates ${first.file.path}:${first.line}${more}`,
        },
      ];
    }),
  );
}

export const duplicatesRule: Rule = { group: "dup", ids, check };
