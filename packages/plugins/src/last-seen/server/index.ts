import type { Setup } from "@slock/core";
import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { jsonResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { isUserId } from "@slock/slack";
import type { UserId } from "@slock/types";

function key(creds: Credentials, userId: string): string {
  return `${creds.route}:${userId}`;
}

const setup: Setup = (ctx) => {
  const env = ctx.get("env");
  const lastSeen = new Map<string, number>();
  const record = (userId: UserId, creds: Credentials) =>
    lastSeen.set(key(creds, userId), env.now());

  ctx.add(
    "http",
    routes([
      route("GET", "users/:id/last-seen", (request) =>
        jsonResponse({
          lastSeen: request.creds
            ? (lastSeen.get(key(request.creds, request.params.id)) ?? null)
            : null,
          ok: true,
        }),
      ),
    ]),
  );
  ctx.add("presence.seen", record);
  ctx.add("realtime.event", {
    handle: (event, creds) => {
      if (event.presence !== "active") return;
      const ids = Array.isArray(event.users) ? event.users : [event.user];
      for (const id of ids) if (typeof id === "string" && isUserId(id)) record(id, creds);
    },
    types: ["presence_change"],
  });
};

export default setup;
