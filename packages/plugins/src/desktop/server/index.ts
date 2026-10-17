import type { Setup } from "@slock/core";
import { findBrowser } from "./findBrowser";

const APP_FLAG = "--app";
const IDLE_MS = 30_000;
const CHECK_MS = 5_000;

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

  let clients = 0;
  let idleSince = Date.now();
  ctx.add("ws", {
    close: () => {
      clients--;
      if (clients === 0) idleSince = Date.now();
    },
    open: () => {
      clients++;
    },
  });
  const watchdog = setInterval(() => {
    if (clients === 0 && Date.now() - idleSince > IDLE_MS) process.exit();
  }, CHECK_MS);
  ctx.onCleanup(() => clearInterval(watchdog));

  ctx.add("server.started", async ({ url }) => {
    const browser = app.browser ?? (await findBrowser());
    if (!browser) fail(`no Chromium based browser found, pass one with ${APP_FLAG} <path>`);
    try {
      const child = Bun.spawn([browser, `--app=${url}`, "--no-first-run"], {
        stderr: "ignore",
        stdout: "ignore",
      });
      child.exited.then((code) => {
        if (code !== 0) fail(`${browser} exited with code ${code}`);
      });
    } catch {
      fail(`could not launch ${browser}`);
    }
  });
};

export default setup;
