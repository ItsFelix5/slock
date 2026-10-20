import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { fetchAppInstallers } from "./appInstallers";
import { listInstalledApps } from "./installedApps";

const USER_ID_RE = /^[UW][A-Z0-9]+$/;
const APP_ID_RE = /^A[A-Z0-9]+$/;

const setup: Setup = (ctx) => {
  ctx.add(
    "http",
    routes([
      route("GET", "users/:id/installed-apps", async (request) => {
        if (!USER_ID_RE.test(request.params.id)) return errorResponse("invalid_user", 400);
        const reply = await listInstalledApps(request.params.id, request.creds);
        if (!reply.ok) return errorResponse(reply.error, 502);
        return jsonResponse({ apps: reply.apps }, request.creds);
      }),
      route("GET", "apps/:id/installers", async (request) => {
        if (!APP_ID_RE.test(request.params.id)) return errorResponse("invalid_app", 400);
        if (!request.creds) return errorResponse("not_configured", 401);
        const installers = await fetchAppInstallers(request.params.id, request.creds);
        if (!installers) return errorResponse("sign_in_required", 502);
        return jsonResponse(installers, request.creds);
      }),
    ]),
  );
};

export default setup;
