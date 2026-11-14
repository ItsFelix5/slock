import { writeFileSync } from "node:fs";
import { areaOf, loadFiles } from "./audit/files";
import {
  countByAreaAndColumn,
  formatViolation,
  groupOf,
  markdownReport,
  table,
} from "./audit/report";
import { RULES } from "./audit/rules";

const args = Bun.argv.slice(2);
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = option("rule")?.split(",");
const areaFilter = option("area");
const markdownPath = option("markdown");

const files = loadFiles();
const all = RULES.flatMap((rule) => rule.check(files));
const violations = all
  .filter(
    (violation) =>
      !only || only.includes(violation.rule) || only.includes(groupOf(RULES, violation.rule)),
  )
  .filter((violation) => !areaFilter || areaOf(violation.path).startsWith(areaFilter))
  .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));

if (!args.includes("--summary")) console.log(violations.map(formatViolation).join("\n"));

const groups = [...new Set(RULES.map((rule) => rule.group))];
const counts = countByAreaAndColumn(violations, areaOf, (rule) => groupOf(RULES, rule));
console.log(`\n${files.length} files, ${violations.length} violations\n`);
console.log(table(counts, groups, false));

if (markdownPath) writeFileSync(markdownPath, markdownReport(violations, RULES, areaOf));
if (args.includes("--strict") && violations.length > 0) process.exit(1);
