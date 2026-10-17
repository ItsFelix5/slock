import type { Setup } from "@slock/core";
import { findBrowser, profileDir } from "./findBrowser";

const APP_FLAG = "--app";

const setup: Setup = (ctx) => {
  if (!Bun.argv.includes(APP_FLAG)) return;
  ctx.add("server.started", async ({ url }) => {
    const browser = await findBrowser();
    if (!browser) {
      console.error(`no Chromium based browser found, open ${url} yourself or set SLOCK_BROWSER`);
      return;
    }
    const child = Bun.spawn(
      [browser, `--app=${url}`, `--user-data-dir=${profileDir()}`, "--no-first-run"],
      { stderr: "ignore", stdout: "ignore" },
    );
    ctx.onCleanup(() => child.kill());
    // Closing the window ends the app, as a hidden background server would just be confusing.
    child.exited.then(() => process.exit());
  });
};

export default setup;
