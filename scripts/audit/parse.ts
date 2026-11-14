import ts from "typescript";
import type { SourceFile } from "./types";

type Comment = { line: number; text: string };
type CommentKind = "suppress" | "todo" | "directive" | "plain";

const parsed = new WeakMap<SourceFile, ts.SourceFile>();
const commented = new WeakMap<SourceFile, Comment[]>();
const SUPPRESS = /@ts-(?:ignore|expect-error|nocheck)|biome-ignore|eslint-disable/;
const TODO = /\b(?:TODO|FIXME)\b/;
const DIRECTIVE = /^\/\/\/\s*<reference|@jsx/;

export function parse(file: SourceFile): ts.SourceFile {
  let tree = parsed.get(file);
  if (!tree) {
    const kind = file.ext === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    tree = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
    parsed.set(file, tree);
  }
  return tree;
}

export function lineOf(tree: ts.SourceFile, node: ts.Node | number): number {
  const position = typeof node === "number" ? node : node.getStart(tree);
  return tree.getLineAndCharacterOfPosition(position).line + 1;
}

export function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function collectComments(tree: ts.SourceFile): Comment[] {
  const found = new Map<number, Comment>();
  const scan = (node: ts.Node) => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    const children = node.getChildren(tree);
    if (children.length === 0) {
      for (const range of ts.getLeadingCommentRanges(tree.text, node.pos) ?? []) {
        found.set(range.pos, {
          line: lineOf(tree, range.pos),
          text: tree.text.slice(range.pos, range.end),
        });
      }
    }
    for (const child of children) scan(child);
  };
  scan(tree);
  return [...found.values()].sort((a, b) => a.line - b.line);
}

export function commentsOf(file: SourceFile): Comment[] {
  let result = commented.get(file);
  if (!result) {
    result = collectComments(parse(file));
    commented.set(file, result);
  }
  return result;
}

export function classifyComment(text: string): CommentKind {
  if (SUPPRESS.test(text)) return "suppress";
  if (TODO.test(text)) return "todo";
  if (DIRECTIVE.test(text)) return "directive";
  return "plain";
}

const WHITESPACE = /\s+/g;

export function preview(text: string): string {
  return text.replace(WHITESPACE, " ").trim().slice(0, 60);
}
