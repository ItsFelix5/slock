import { existsSync, statSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { type Manifest, readManifest } from "@slock/core";
import { type Download, downloadRepo, parseGithub } from "./github";
import { PLUGINS_SRC, REPO } from "./paths";
import { parseLine, type Spec } from "./spec";

const SLOCK_SOURCE = "github.com/itsfelix5/slock";

export type Candidate = {
  manifest: Manifest;
  dir: string;
  source: string;
  from: string;
  commit: string;
  off: boolean;
};

export type Session = {
  tmp: string;
  downloads: Download[];
  slock: string;
  cleanup(): Promise<void>;
};

type Located = {
  path: string;
  source: string;
  commit: string;
  from(dir: string): string;
};

async function gitCommit(dir: string): Promise<string> {
  const run = (...args: string[]) =>
    Bun.spawn(["git", "-C", dir, ...args], { stderr: "ignore", stdout: "pipe" });
  const head = run("rev-parse", "--short", "HEAD");
  const sha = (await new Response(head.stdout).text()).trim();
  if ((await head.exited) !== 0) return "local";
  const status = run("status", "--porcelain", "--", ".");
  const dirty = (await new Response(status.stdout).text()).trim() !== "";
  return dirty ? `${sha}+dirty` : sha;
}

export async function openSession(): Promise<Session> {
  const tmp = await mkdtemp(join(tmpdir(), "slock-install-"));
  return {
    cleanup: () => rm(tmp, { force: true, recursive: true }),
    downloads: [],
    slock: await gitCommit(REPO),
    tmp,
  };
}

async function locate(spec: Spec, base: string, session: Session): Promise<Located> {
  if (spec.kind === "id") {
    return {
      commit: session.slock,
      from: (dir) => basename(dir),
      path: join(PLUGINS_SRC, spec.value),
      source: `${SLOCK_SOURCE} ${spec.value}`,
    };
  }
  if (spec.kind === "path") {
    const path = resolve(base, spec.value);
    return { commit: await gitCommit(path), from: (dir) => dir, path, source: path };
  }
  const github = parseGithub(spec.value, spec.ref);
  const download = await downloadRepo(github, session.tmp);
  session.downloads.push(download);
  return {
    commit: download.commit,
    from: (dir) =>
      `https://${download.label}/tree/${github.ref ?? "HEAD"}/${relative(download.root, dir)}`,
    path: join(download.root, github.subpath),
    source: `${download.label}${github.subpath ? `/${github.subpath}` : ""}`,
  };
}

async function readCandidate(dir: string, located: Located, off: boolean): Promise<Candidate> {
  const path = join(dir, "plugin.json");
  const manifest = readManifest(JSON.parse(await readFile(path, "utf8")), path);
  return {
    commit: located.commit,
    dir,
    from: located.from(dir),
    manifest,
    off,
    source: located.source,
  };
}

async function pluginDirs(path: string): Promise<string[]> {
  if (existsSync(join(path, "plugin.json"))) return [path];
  const children = (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(path, entry.name, "plugin.json")))
    .map((entry) => join(path, entry.name))
    .sort();
  if (children.length === 0) throw new Error(`${path}: no plugin.json here or in any subfolder`);
  return children;
}

export async function resolveSpec(
  spec: Spec,
  base: string,
  session: Session,
  trail: string[] = [],
): Promise<Candidate[]> {
  const located = await locate(spec, base, session);
  if (!existsSync(located.path)) throw new Error(`${spec.value}: nothing found at ${located.path}`);
  if (!statSync(located.path).isFile()) {
    const dirs = await pluginDirs(located.path);
    return Promise.all(dirs.map((dir) => readCandidate(dir, located, spec.off)));
  }
  if (trail.includes(located.path))
    throw new Error(`list cycle: ${[...trail, located.path].join(" > ")}`);
  const lines = (await readFile(located.path, "utf8")).split("\n").filter((line) => line.trim());
  const found: Candidate[] = [];
  for (const line of lines)
    for (const inner of parseLine(line, spec.off))
      found.push(
        ...(await resolveSpec(inner, dirname(located.path), session, [...trail, located.path])),
      );
  return found;
}
