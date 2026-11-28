import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmPlan, describePlan, type Prompter } from "../../packages/installer/src/confirm";
import { buildPlan } from "../../packages/installer/src/plan";
import { candidateOf, unitOf, writePlugin } from "./fixtures";

let root = "";
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "installer-plan-"));
});
afterAll(() => rmSync(root, { force: true, recursive: true }));

const server = { "server/index.ts": "export default () => {};" };

function stagedOf(id: string, extra: Record<string, unknown> = {}, commit = "abc") {
  const dir = writePlugin(root, id, extra, server);
  return { candidate: candidateOf(dir, commit), dependencies: {}, dir };
}

function prompter(interactive: boolean, answer = "y") {
  const lines: string[] = [];
  const asked: string[] = [];
  const result: Prompter = {
    ask: (question) => {
      asked.push(question);
      return Promise.resolve(answer);
    },
    interactive,
    print: (line) => lines.push(line),
  };
  return { asked, lines, prompter: result };
}

const planFor = (
  staged: ReturnType<typeof stagedOf>[],
  existing = [] as ReturnType<typeof unitOf>[],
) => buildPlan({ command: "install", downloads: [], existing, slock: "s1", staged });

test("an install lists adds, server code, writes and the rebuild", () => {
  const text = describePlan(planFor([stagedOf("alpha"), stagedOf("beta", { off: false })])).join(
    "\n",
  );
  expect(text).toContain("add");
  expect(text).toContain("alpha");
  expect(text).toContain("server halves run inside the server process: alpha, beta");
  expect(text).toContain("plugins/{alpha, beta}");
  expect(text).toContain("rebuild");
});

test("a same commit reinstall changes nothing and a new commit is a replace", () => {
  const first = stagedOf("gamma", {}, "c1");
  const installed = { ...unitOf(first.dir, "c1") };
  const same = planFor([first], [installed]);
  expect(same.adds.length + same.replaces.length).toBe(0);
  const newer = planFor([stagedOf("gamma", {}, "c2")], [installed]);
  expect(newer.replaces.length).toBe(1);
  expect(describePlan(newer).join("\n")).toContain("c1 -> c2");
});

test("confirmPlan asks, and --yes skips only the question", async () => {
  const plan = planFor([stagedOf("delta")]);
  const asked = prompter(true, "n");
  expect(await confirmPlan(plan, asked.prompter, false)).toBe(false);
  expect(asked.asked.length).toBe(1);
  const yes = prompter(true);
  expect(await confirmPlan(plan, yes.prompter, true)).toBe(true);
  expect(yes.asked.length).toBe(0);
  expect(yes.lines.join("\n")).toContain("delta");
});

test("without a terminal and without --yes it refuses", async () => {
  const plan = planFor([stagedOf("epsilon")]);
  await expect(confirmPlan(plan, prompter(false).prompter, false)).rejects.toThrow("pass --yes");
});

test("removing a required plugin is refused unless forced", () => {
  const base = unitOf(writePlugin(root, "root-plugin"));
  const top = unitOf(writePlugin(root, "leaf", { requires: ["root-plugin"] }));
  const remove = (force: boolean) =>
    buildPlan({
      command: "uninstall",
      downloads: [],
      existing: [base, top],
      force,
      removeIds: ["root-plugin"],
      slock: "s1",
      staged: [],
    });
  expect(() => remove(false)).toThrow("required by leaf");
  expect(remove(true).removes.length).toBe(1);
});

test("dirty and foreign sources produce one summarised warning each", () => {
  const many = ["w1", "w2", "w3", "w4", "w5"].map((id) => stagedOf(id, {}, "abc+dirty"));
  const plan = planFor(many);
  expect(plan.warnings.length).toBe(1);
  expect(plan.warnings[0]).toContain("and 2 more");
});
