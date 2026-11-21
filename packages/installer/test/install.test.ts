import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../src/commands";
import type { Prompter } from "../src/confirm";
import { parseCommand } from "../src/spec";
import { writePlugin } from "./fixtures";

const MAX_PRELOADS = 6;
const BUILD_TIMEOUT = 180_000;

let root = "";
let instance = "";
let mine = "";
const output: string[] = [];

const prompter: Prompter = {
  ask: () => Promise.resolve("n"),
  interactive: false,
  print: (line) => output.push(line),
};

const run = (...args: string[]) =>
  runCommand(parseCommand([...args, "--dir", instance, "--yes"]), prompter);

const sourcesIn = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts"),
    )
    .map((entry) => join(entry.parentPath, entry.name));

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "installer-e2e-"));
  instance = join(root, "instance");
  mine = writePlugin(
    root,
    "mine",
    {},
    {
      "client/index.tsx": "export default function setup() {}\n",
      "server/index.ts": "export default function setup() {}\n",
    },
  );
});

afterAll(() => rmSync(root, { force: true, recursive: true }));

test(
  "install writes built code only, boots, and stays inside the request budget",
  async () => {
    await run("install", "core", mine);
    expect(sourcesIn(instance)).toEqual([]);
    expect(existsSync(join(instance, "server.js"))).toBe(true);
    expect(existsSync(join(instance, "plugins/mine/plugin.json"))).toBe(true);

    const probe = Bun.serve({ fetch: () => new Response(), port: 0 });
    const { port } = probe;
    await probe.stop(true);
    const server = Bun.spawn(["bun", "server.js"], {
      cwd: instance,
      env: { ...process.env, SLOCK_PORT: String(port) },
      stderr: "pipe",
      stdout: "pipe",
    });
    try {
      let html = "";
      for (let attempt = 0; attempt < 100 && !html; attempt++) {
        html = await fetch(`http://localhost:${port}/`)
          .then((response) => (response.ok ? response.text() : ""))
          .catch(() => "");
        if (!html) await Bun.sleep(100);
      }
      expect(html).toContain("<script");
      expect(html.match(/rel="modulepreload"/g)?.length ?? 0).toBeLessThanOrEqual(MAX_PRELOADS);
    } finally {
      server.kill();
    }
  },
  BUILD_TIMEOUT,
);

test(
  "uninstall removes the unit and leaves no temp checkout behind",
  async () => {
    await run("uninstall", "mine");
    expect(existsSync(join(instance, "plugins/mine"))).toBe(false);
    expect(sourcesIn(instance)).toEqual([]);
    expect(output.join("\n")).toContain("remove");
  },
  BUILD_TIMEOUT,
);
