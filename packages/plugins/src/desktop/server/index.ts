import type { Setup } from "@slock/core";
import { findBrowser } from "./findBrowser";
import { createTray, type Tray } from "./tray";

const APP_FLAG = "--app";
const TRAY_FLAG = "--tray";
const IDLE_MS = 30_000;
const CHECK_MS = 5_000;
const OWNED_MS = 3_000;
const REOPEN_MS = 1_500;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function appFlag(): { browser?: string; tray: boolean } | undefined {
  const tray = Bun.argv.includes(TRAY_FLAG);
  const at = Bun.argv.indexOf(APP_FLAG);
  if (at === -1) return tray ? { tray } : undefined;
  const next = Bun.argv[at + 1];
  return { browser: next && !next.startsWith("--") ? next : undefined, tray };
}

const setup: Setup = (ctx) => {
  const app = appFlag();
  if (!app) return;

  const sockets = new Set<unknown>();
  let idleSince = Date.now();
  let lastTick = Date.now();
  let lastOpen = 0;
  let tray: Tray | undefined;

  ctx.add("ws", {
    close: (ws) => {
      sockets.delete(ws);
      if (sockets.size === 0) idleSince = Date.now();
    },
    open: (ws) => {
      sockets.add(ws);
    },
  });
  const watchdog = setInterval(() => {
    const now = Date.now();
    if (now - lastTick > CHECK_MS * 3) idleSince = now;
    lastTick = now;
    if (!tray && sockets.size === 0 && now - idleSince > IDLE_MS) process.exit();
  }, CHECK_MS);
  const closeTray = () => tray?.close();
  ctx.onCleanup(() => {
    clearInterval(watchdog);
    closeTray();
  });
  process.on("exit", closeTray);

  function launch(browser: string, url: string, initial: boolean) {
    const problem = (message: string) =>
      initial || !tray ? fail(message) : console.error(message);
    const launched = Date.now();
    lastOpen = launched;
    try {
      const child = Bun.spawn([browser, `--app=${url}`, "--no-first-run"], {
        stderr: "ignore",
        stdout: "ignore",
      });
      child.exited.then((code) => {
        if (code !== 0) problem(`${browser} exited with code ${code}`);
        else if (!tray && Date.now() - launched > OWNED_MS) process.exit();
      });
    } catch {
      problem(`could not launch ${browser}`);
    }
  }

  ctx.add("server.started", async ({ url }) => {
    const browser = app.browser ?? (await findBrowser());
    if (!browser) fail(`no Chromium based browser found, pass one with ${APP_FLAG} <path>`);
    launch(browser, url, true);
    if (!app.tray) return;
    try {
      const created = await createTray({
        lost: () => {
          tray = undefined;
          idleSince = Date.now();
        },
        open: () => {
          if (sockets.size > 0 || Date.now() - lastOpen < REOPEN_MS) return;
          launch(browser, url, false);
        },
        quit: () => process.exit(),
      });
      tray = created;
    } catch (error) {
      console.error(`no tray available, closing the window ends the app: ${error}`);
    }
  });
};

export default setup;
