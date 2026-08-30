import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const PACKAGES = join(ROOT, "packages");
const BASELINE_FILE = join(import.meta.dirname, "claude-md-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(entry))) out.push(full);
  }
  return out;
}

const TEST_NAME_RE = /\.(test|spec)\.tsx?$/;
const MIN_LINES = 15;
const IGNORED_COMMENT_RE =
  /^(\/\/\s*biome-ignore|\/\/\s*@ts-expect-error|\/\/\s*@ts-ignore|\/\*\s*@refresh\s|\/\*\s*@vite-ignore\s)/;

const files = walk(PACKAGES, [".ts", ".tsx"]);
const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (TEST_NAME_RE.test(file)) {
    findings.push({ file: rel, line: 1, rule: "no-tests", text: "test file" });
    continue;
  }

  const source = readFileSync(file, "utf8");
  const lineCount = source.trimEnd().split("\n").length;
  if (lineCount < MIN_LINES) {
    findings.push({ file: rel, line: 1, rule: "small-file", text: `${lineCount} lines` });
  }

  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lineOf = (pos) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  const fullText = sourceFile.getFullText();
  const seenCommentStarts = new Set();
  function collectComments(node) {
    const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart()) ?? [];
    for (const r of ranges) {
      if (seenCommentStarts.has(r.pos)) continue;
      seenCommentStarts.add(r.pos);
      const text = fullText.slice(r.pos, r.end);
      if (!IGNORED_COMMENT_RE.test(text)) {
        findings.push({
          file: rel,
          line: lineOf(r.pos),
          rule: "no-comments",
          text: text.split("\n")[0].slice(0, 80),
        });
      }
    }
    for (const child of node.getChildren(sourceFile)) collectComments(child);
  }
  collectComments(sourceFile);

  function visit(node) {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const typeText = node.type.getText(sourceFile);
      if (typeText !== "const") {
        findings.push({
          file: rel,
          line: lineOf(node.getStart(sourceFile)),
          rule: "no-as-cast",
          text: node.getText(sourceFile).slice(0, 80),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const byRule = { "no-as-cast": [], "no-comments": [], "no-tests": [], "small-file": [] };
for (const f of findings) byRule[f.rule].push(f);

function report(title, items, hint) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length})`);
  console.log(hint);
  for (const it of items) console.log(`  ${it.file}:${it.line}  ${it.text}`);
}

report(
  "No comments allowed (CLAUDE.md)",
  byRule["no-comments"],
  "If the code needs a comment to make sense, rewrite the code instead.",
);
report(
  "No 'as' type assertions (CLAUDE.md)",
  byRule["no-as-cast"],
  "'as const' is fine. Anything else - narrow the type instead, or add an override to biome.jsonc if this is a genuine untyped-external-data boundary.",
);
report(
  "No test files (CLAUDE.md: 'Stop writing tests')",
  byRule["no-tests"],
  "Delete this file, or move whatever it's checking into manual verification.",
);
report(
  `Files under ${MIN_LINES} lines`,
  byRule["small-file"],
  "Fold it into its one consumer, unless it's genuinely shared state with no single natural home.",
);

let ok = byRule["no-comments"].length === 0 && byRule["no-tests"].length === 0;

const RATCHET_RULES = ["no-as-cast", "small-file"];
const defaultBaseline = Object.fromEntries(RATCHET_RULES.map((rule) => [rule, 0]));
const baseline = existsSync(BASELINE_FILE)
  ? { ...defaultBaseline, ...JSON.parse(readFileSync(BASELINE_FILE, "utf8")) }
  : defaultBaseline;
const counts = Object.fromEntries(RATCHET_RULES.map((rule) => [rule, byRule[rule].length]));

if (updateBaseline) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`\nUpdated baseline: ${JSON.stringify(counts)}`);
} else {
  for (const rule of RATCHET_RULES) {
    if (counts[rule] > baseline[rule]) {
      console.log(
        `\n${rule} went up: ${baseline[rule]} -> ${counts[rule]}. This rule doesn't block on ` +
          "the existing debt, only on adding to it. If the baseline count is genuinely wrong, " +
          "rerun with --update-baseline.",
      );
      ok = false;
    } else if (counts[rule] < baseline[rule]) {
      console.log(
        `\n${rule} went down: ${baseline[rule]} -> ${counts[rule]}. Nice - rerun with ` +
          "--update-baseline to lock that in.",
      );
    }
  }
}

if (ok) {
  console.log(`\nNo blocking CLAUDE.md violations (${JSON.stringify(counts)} within baseline).`);
} else {
  console.log(`\n${findings.length} CLAUDE.md violation(s) found.`);
  process.exit(1);
}
