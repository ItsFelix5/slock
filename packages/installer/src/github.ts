import { mkdir } from "node:fs/promises";
import { join } from "node:path";

type GithubRef = { owner: string; repo: string; ref?: string; subpath: string };

const TREE_OR_BLOB = /^(?:tree|blob)$/;
const GIT_SUFFIX = /\.git$/;

export function parseGithub(url: string, hashRef?: string): GithubRef {
  const { hostname, pathname } = new URL(url);
  if (hostname !== "github.com") throw new Error(`${url}: only github.com urls are supported`);
  const [owner, rawRepo, kind, ref, ...rest] = pathname.split("/").filter(Boolean);
  if (!(owner && rawRepo)) throw new Error(`${url}: expected github.com/<owner>/<repo>`);
  const repo = rawRepo.replace(GIT_SUFFIX, "");
  const tree = kind !== undefined && TREE_OR_BLOB.test(kind);
  return {
    owner,
    ref: hashRef ?? (tree ? ref : undefined),
    repo,
    subpath: tree ? rest.join("/") : "",
  };
}

export type Download = { label: string; commit: string; bytes: number; root: string };

async function getOk(url: string, accept?: string): Promise<Response> {
  const response = await fetch(url, accept ? { headers: { accept } } : undefined);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response;
}

export async function downloadRepo(
  { owner, ref, repo }: GithubRef,
  into: string,
): Promise<Download> {
  const base = `${owner}/${repo}`;
  const commit = (
    await (
      await getOk(
        `https://api.github.com/repos/${base}/commits/${ref ?? "HEAD"}`,
        "application/vnd.github.sha",
      )
    ).text()
  ).trim();
  const tarball = await (
    await getOk(`https://codeload.github.com/${base}/tar.gz/${commit}`)
  ).blob();
  const archive = new Bun.Archive(tarball);
  const root = join(into, `${owner}-${repo}-${commit.slice(0, 7)}`);
  await mkdir(root, { recursive: true });
  await archive.extract(root);
  const [top] = [...new Bun.Glob("*").scanSync({ cwd: root, onlyFiles: false })];
  return {
    bytes: tarball.size,
    commit: commit.slice(0, 7),
    label: `github.com/${base}`,
    root: top ? join(root, top) : root,
  };
}
