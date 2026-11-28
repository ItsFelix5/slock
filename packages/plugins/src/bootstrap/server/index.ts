import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import {
  isHostedChannel,
  trimBootChannel,
} from "@slock/plugins/slack/server/api/trim/slackChannels";
import { trimUser } from "@slock/plugins/slack/server/api/trim/slackEntities";
import type { BootstrapPayload, RawChannel, RawUser } from "@slock/types";
import { slackPart } from "./api";

const OPTIONAL_PART_WAIT_MS = 1200;

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
      topic: group.topic,
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
  const env = ctx.get("env");
  ctx.add(
    "bootstrap.part",
    slackPart("bootstrap", "client.userBoot", trimUserBoot, { required: true }),
  );
  const parts = ctx.use("bootstrap.part");
  ctx.add(
    "http",
    routes([
      route("GET", "bootstrap", async ({ creds }) => {
        const timeout = new Promise<null>((resolve) =>
          env.setTimeout(() => resolve(null), OPTIONAL_PART_WAIT_MS),
        );
        const results = await Promise.all(
          parts().map(async (part) => {
            const loading = part.load(creds);
            const result = await (part.required ? loading : Promise.race([loading, timeout]));
            return { part, result };
          }),
        );
        const payload: BootstrapPayload = {};
        const errors: Record<string, string> = {};
        const retryAfter: Record<string, string> = {};
        const pending: string[] = [];
        for (const { part, result } of results) {
          if (!result) pending.push(part.name);
          else if (result.ok) Object.assign(payload, result.payload);
          else if (!part.optional) {
            errors[part.name] = result.error;
            if (result.retryAfter) retryAfter[part.name] = result.retryAfter;
          }
        }
        payload.error = Object.keys(errors).length > 0 ? errors : undefined;
        payload.retry_after = Object.keys(retryAfter).length > 0 ? retryAfter : undefined;
        payload.pending = pending.length > 0 ? pending : undefined;
        return jsonResponse(payload);
      }),
      route("GET", "bootstrap/:part", async ({ creds, params }) => {
        const part = parts().find((candidate) => candidate.name === params.part);
        if (!part) return errorResponse("unknown_part", 404);
        const result = await part.load(creds);
        if (!result.ok) return errorResponse(result.error, 502);
        return jsonResponse({ ...result.payload, ok: true });
      }),
    ]),
  );
};

export default setup;

type UserBootReply = {
  channels?: RawChannel[];
  ims?: { created?: number; id: string; is_open?: boolean; updated?: number; user?: string }[];
  is_open?: string[];
  mpims?: RawChannel[];
  self?: RawUser;
  starred?: (string | { channel?: string; id?: string })[];
  subteams?: { self?: string[] };
};
