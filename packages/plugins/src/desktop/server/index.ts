import type { Setup } from "@slock/core";
import { findBrowser, profileDir } from "./findBrowser";

const APP_FLAG = "--app";

function appFlag(): { browser?: string } | undefined {
  const at = Bun.argv.indexOf(APP_FLAG);
  if (at === -1) return;
  const next = Bun.argv[at + 1];
  return next && !next.startsWith("--") ? { browser: next } : {};
}

const setup: Setup = (ctx) => {
  const app = appFlag();
  if (!app) return;
  ctx.add("server.started", async ({ url }) => {
    const browser = app.browser ?? (await findBrowser());
    if (!browser) {
      console.error(`no Chromium based browser found, pass one with ${APP_FLAG} <path>`);
      return;
    }
    const child = Bun.spawn(
      [browser, `--app=${url}`, `--user-data-dir=${profileDir()}`, "--no-first-run"],
      { stderr: "ignore", stdout: "ignore" },
    );
    ctx.onCleanup(() => child.kill());
    child.exited.then(() => process.exit());
  });
};

export default setup;
