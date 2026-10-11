import type { Setup } from "@slock/core";
import type { BootstrapPayload } from "@slock/types";
import { jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import type { UserBootReply } from "../../slack/server/api/slackReplies";
import { isHostedChannel, trimBootChannel } from "../../slack/server/api/trim/slackChannels";
import { trimUser } from "../../slack/server/api/trim/slackEntities";
import { slackPart } from "./api";

function trimUserBoot(data: UserBootReply): BootstrapPayload {
  return {
    channels: data.channels?.filter((channel) => !isHostedChannel(channel)).map(trimBootChannel),
    ims: data.ims?.map((im) => ({
      created: im.created,
      id: im.id,
      is_open: im.is_open,
      updated: im.updated,
      user: im.user,
    })),
    is_open: data.is_open,
    mpims: data.mpims?.map((group) => ({
      created: group.created,
      id: group.id,
      is_open: group.is_open,
      members: group.members,
      name: group.name,
      properties: group.properties
        ? { has_custom_mpdm_name: group.properties.has_custom_mpdm_name }
        : undefined,
      updated: group.updated,
    })),
    self: data.self ? trimUser(data.self) : undefined,
    starred: data.starred?.map((star) =>
      typeof star === "string" ? star : { channel: star.channel, id: star.id },
    ),
    subteams: data.subteams?.self ? { self: data.subteams.self } : undefined,
  };
}

const setup: Setup = (ctx) => {
  ctx.add("bootstrap.part", slackPart("bootstrap", "client.userBoot", trimUserBoot));
  const parts = ctx.use("bootstrap.part");
  ctx.add(
    "http",
    routes([
      route("GET", "bootstrap", async ({ creds }) => {
        const results = await Promise.all(
          parts().map(async (part) => ({ part, result: await part.load(creds) })),
        );
        const payload: BootstrapPayload = {};
        const errors: Record<string, string> = {};
        const retryAfter: Record<string, string> = {};
        for (const { part, result } of results) {
          if (result.ok) Object.assign(payload, result.payload);
          else if (!part.optional) {
            errors[part.name] = result.error;
            if (result.retryAfter) retryAfter[part.name] = result.retryAfter;
          }
        }
        payload.error = Object.keys(errors).length > 0 ? errors : undefined;
        payload.retry_after = Object.keys(retryAfter).length > 0 ? retryAfter : undefined;
        return jsonResponse(payload, creds);
      }),
    ]),
  );
};

export default setup;
