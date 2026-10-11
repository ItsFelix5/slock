import type { Setup } from "@slock/core";
import type { Credentials } from "../../slack/server/api/auth";
import { jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";

function key(creds: Credentials, userId: string): string {
  return `${creds.route}:${userId}`;
}

const setup: Setup = (ctx) => {
  const lastSeen = new Map<string, number>();
  const record = (userId: string, creds: Credentials) =>
    lastSeen.set(key(creds, userId), Date.now());

  ctx.add(
    "http",
    routes([
      route("GET", "last-seen/:id", (request) =>
        jsonResponse(
          {
            lastSeen: request.creds
              ? (lastSeen.get(key(request.creds, request.params.id)) ?? null)
              : null,
            ok: true,
          },
          request.creds,
        ),
      ),
    ]),
  );
  ctx.add("presence.seen", record);
  ctx.add("realtime.event", {
    handle: (event, creds) => {
      if (event.presence !== "active") return;
      const ids = Array.isArray(event.users) ? event.users : [event.user];
      for (const id of ids) if (typeof id === "string") record(id, creds);
    },
    types: ["presence_change"],
  });
};

export default setup;
