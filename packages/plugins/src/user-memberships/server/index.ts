import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { listMemberships } from "./memberships";

const USER_ID_RE = /^[UW][A-Z0-9]+$/;

const setup: Setup = (ctx) => {
  ctx.add(
    "http",
    routes([
      route("GET", "users/:id/memberships", async (request) => {
        if (!USER_ID_RE.test(request.params.id)) return errorResponse("invalid_user", 400);
        const reply = await listMemberships(request.params.id, request.creds);
        if (!reply.ok) return errorResponse(reply.error, 502);
        return jsonResponse({ memberships: reply.memberships });
      }),
    ]),
  );
};

export default setup;
