import type { Context } from "@slock/core";
import type { Services } from "@slock/core/types";
import { reportActivity } from "../../slack/client/api";

const THROTTLE_MS = 30_000;
const EVENTS = ["pointerdown", "keydown", "focus", "visibilitychange"] as const;

export function reportActivityWhileAway(ctx: Context, users: Services["users"]) {
  let last = 0;
  let inFlight = false;

  function onActivity() {
    const self = users.currentUser();
    if (self?.presence !== "away" || inFlight || document.visibilityState !== "visible") return;
    if (Date.now() - last < THROTTLE_MS) return;
    last = Date.now();
    inFlight = true;
    reportActivity()
      .then((activated) => activated && users.setPresenceOverrides(self.id, "active"))
      .catch(() => {})
      .finally(() => {
        inFlight = false;
      });
  }

  for (const name of EVENTS) window.addEventListener(name, onActivity, true);
  ctx.onCleanup(() => {
    for (const name of EVENTS) window.removeEventListener(name, onActivity, true);
  });
}
