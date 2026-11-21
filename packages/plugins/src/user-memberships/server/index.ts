import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { listMemberships } from "./memberships";

const setup: Setup = (ctx) => {
  ctx.add(
    "http",
    routes([
      route("GET", "users/:id/memberships", async (request) => {
        const reply = await listMemberships(request.params.id, request.creds);
        if (!reply.ok) return errorResponse(reply.error, 502);
        return jsonResponse({ memberships: reply.memberships });
      }),
    ]),
  );
};

export default setup;
