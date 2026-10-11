import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack, callSlackMultipart } from "../../slack/server/api/slackClient";
import type { SetPhotoReply, UserProfileReply } from "../../slack/server/api/slackReplies";
import { trimProfile } from "../../slack/server/api/trim/slackEntities";
import { appProfileRoutes } from "./appProfile";
import { fieldRoutes } from "./fields";

const list: Route[] = [
  route("GET", "users/:id/profile", async (ctx) => {
    const params: Record<string, string> = ctx.params.id === "me" ? {} : { user: ctx.params.id };
    const data = await callSlack<UserProfileReply>("users.profile.get", params, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "users.profile.get", ctx.creds);
    return jsonResponse({ ok: true, profile: trimProfile(data.profile) }, ctx.creds);
  }),

  route("PUT", "profile", async (ctx) => {
    const { profile } = await ctx.body.json<{
      profile?: Record<string, unknown>;
    }>();
    if (!profile) return errorResponse("invalid_profile", 400);
    return mutate("users.profile.set", { profile: JSON.stringify(profile) }, ctx);
  }),

  route("POST", "profile/photo", async (ctx) => {
    const filename = ctx.searchParams.get("filename") ?? "profile-photo";
    const type = ctx.searchParams.get("type") ?? "application/octet-stream";
    if (!type.startsWith("image/")) return errorResponse("invalid_image", 400);
    const bytes = await ctx.body.buffer();
    if (!bytes.length || bytes.length > 10 * 1024 * 1024)
      return errorResponse("invalid_image", 400);
    const data = await callSlackMultipart<SetPhotoReply>(
      "users.setPhoto",
      {},
      { bytes, field: "image", filename, type },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "users.setPhoto", ctx.creds);
    const profile = data.profile ?? data.user?.profile;
    return jsonResponse({ ok: true, profile: profile && trimProfile(profile) }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes([...list, ...fieldRoutes, ...appProfileRoutes]));
};

export default setup;
