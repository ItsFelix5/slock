import type { Setup } from "@slock/core";
import { findBrowser } from "./findBrowser";

const APP_FLAG = "--app";
const HANDOFF_MS = 3000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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
    if (!browser) fail(`no Chromium based browser found, pass one with ${APP_FLAG} <path>`);
    const launched = Date.now();
    const child = (() => {
      try {
        return Bun.spawn([browser, `--app=${url}`, "--no-first-run"], {
          stderr: "ignore",
          stdout: "ignore",
        });
      } catch {
        return fail(`could not launch ${browser}`);
      }
    })();
    ctx.onCleanup(() => child.kill());
    child.exited.then((code) => {
      if (code !== 0) fail(`${browser} exited with code ${code}`);
      if (Date.now() - launched > HANDOFF_MS) process.exit();
    });
  });
};

export default setup;
