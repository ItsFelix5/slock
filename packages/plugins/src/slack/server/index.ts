import type { Setup } from "@slock/core";
import { slackAssetResponse } from "./api/assets";
import { route, routes } from "./api/router";
import { accountAvatarResponse, credentialsFromCookie, removeAccount } from "./api/session";

const STATIC_PREFIXES = ["/assets/", "/public/"];

const sessionRoutes = [
  route("DELETE", "session/:id", (ctx) => removeAccount(ctx.cookie, ctx.params.id ?? "")),
  route("GET", "accounts/:id/avatar", (ctx) =>
    accountAvatarResponse(ctx.cookie, ctx.params.id ?? ""),
  ),
  route("GET", "assets/:capability", (ctx) =>
    slackAssetResponse(ctx.params.capability, ctx.creds, ctx.acceptEncoding, ctx.range),
  ),
];

const setup: Setup = (ctx) => {
  ctx.add(
    "http",
    (c, next) => {
      const isStatic = STATIC_PREFIXES.some((prefix) => c.url.pathname.startsWith(prefix));
      c.creds = isStatic ? null : credentialsFromCookie(c.req.headers.get("cookie"));
      return next();
    },
    { order: 900 },
  );
  ctx.add("http", routes(sessionRoutes));
};

export default setup;
