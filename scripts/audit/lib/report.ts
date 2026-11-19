import type { Rule, Violation } from "./types";

type Counts = Map<string, Map<string, number>>;

const TOP_FILES = 40;

export function groupOf(rules: Rule[], id: string): string {
  return rules.find((rule) => rule.ids.includes(id))?.group ?? id;
}

export function countByAreaAndColumn(
  violations: Violation[],
  areaOf: (path: string) => string,
  columnOf: (rule: string) => string,
): Counts {
  const counts: Counts = new Map();
  for (const violation of violations) {
    const row = counts.get(areaOf(violation.path)) ?? new Map<string, number>();
    const column = columnOf(violation.rule);
    row.set(column, (row.get(column) ?? 0) + 1);
    counts.set(areaOf(violation.path), row);
  }
  return counts;
}

function rowTotal(row: Map<string, number>): number {
  return [...row.values()].reduce((sum, count) => sum + count, 0);
}

export function table(counts: Counts, columns: string[], markdown: boolean): string {
  const rows = [...counts].sort((a, b) => rowTotal(b[1]) - rowTotal(a[1]));
  const totals = columns.map((column) =>
    rows.reduce((sum, [, row]) => sum + (row.get(column) ?? 0), 0),
  );
  const cells = [
    ["area", ...columns, "total"],
    ...rows.map(([area, row]) => [
      area,
      ...columns.map((column) => String(row.get(column) ?? 0)),
      String(rowTotal(row)),
    ]),
    ["all", ...totals.map(String), String(totals.reduce((sum, count) => sum + count, 0))],
  ];
  if (markdown) {
    const [head, ...body] = cells.map((row) => `| ${row.join(" | ")} |`);
    return [head, `|${cells[0]?.map(() => " --- |").join("")}`, ...body].join("\n");
  }
  const widths = (cells[0] ?? []).map((_, index) =>
    Math.max(...cells.map((row) => row[index]?.length ?? 0)),
  );
  return cells
    .map((row) =>
      row
        .map((cell, index) =>
          index === 0 ? cell.padEnd(widths[0] ?? 0) : cell.padStart(widths[index] ?? 0),
        )
        .join("  "),
    )
    .join("\n");
}

function worstFiles(violations: Violation[]): [string, number][] {
  const perFile = new Map<string, number>();
  for (const violation of violations) {
    perFile.set(violation.path, (perFile.get(violation.path) ?? 0) + 1);
  }
  return [...perFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, TOP_FILES);
}

export function formatViolation(violation: Violation): string {
  return `${violation.rule} ${violation.path}:${violation.line} ${violation.message}`;
}

export function markdownReport(
  violations: Violation[],
  rules: Rule[],
  areaOf: (path: string) => string,
): string {
  const byId = countByAreaAndColumn(violations, areaOf, (rule) => rule);
  const byGroup = countByAreaAndColumn(violations, areaOf, (rule) => groupOf(rules, rule));
  const ids = rules.flatMap((rule) => rule.ids);
  const groups = rules
    .map((rule) => rule.group)
    .filter((group, index, all) => all.indexOf(group) === index);
  const worst = worstFiles(violations).map(
    ([path, count], index) => `${index + 1}. ${path} (${count})`,
  );
  return [
    "# Audit",
    `${violations.length} violations.`,
    "## Per area and rule group",
    table(byGroup, groups, true),
    "## Per area and rule id",
    table(byId, ids, true),
    `## Top ${TOP_FILES} files`,
    worst.join("\n"),
    "",
  ].join("\n\n");
}
