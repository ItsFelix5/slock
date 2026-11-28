import type { Setup } from "@slock/core";
import { slackPart } from "@slock/plugins/bootstrap/server/api";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, prefWrite, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { BootstrapPayload, BootstrapSection, RawChannelSection } from "@slock/types";

const list: Route[] = [
  route("GET", "sections", async (ctx) => {
    const data = await callSlack<ChannelSectionsReply>("users.channelSections.list", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "users.channelSections.list");
    }
    return jsonResponse({ channel_sections: data.channel_sections?.map(trimChannelSection) });
  }),

  route("POST", "sections", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack<CreatedSectionReply>(
      "users.channelSections.create",
      { emoji: "", name, type: "standard" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "users.channelSections.create");
    }
    const section = data.channel_section ?? data;
    return jsonResponse({
      channel_section: {
        channel_section_id: section.channel_section_id,
        id: section.id,
        name: section.name,
      },
      ok: true,
    });
  }),

  route("PATCH", "sections/:id", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_patch", 400);
    return mutate("users.channelSections.set", { channel_section_id: ctx.params.id, name }, ctx);
  }),

  route("DELETE", "sections/:id", (ctx) =>
    mutate("users.channelSections.delete", { channel_section_id: ctx.params.id }, ctx),
  ),

  route("PUT", "sections/:id/order", async (ctx) => {
    const { nextSectionId } = await ctx.body.json<{
      nextSectionId?: string | null;
    }>();
    return mutate(
      "users.channelSections.set",
      {
        channel_section_id: ctx.params.id,
        ...(nextSectionId ? { next_channel_section_id: nextSectionId } : {}),
      },
      ctx,
    );
  }),

  route("PUT", "sections/:id/channels", async (ctx) => {
    const { insertChannelIds, removeChannelIds } = await ctx.body.json<{
      insertChannelIds?: string[];
      removeChannelIds?: string[];
    }>();
    const insert = insertChannelIds?.length
      ? [{ channel_ids: insertChannelIds, channel_section_id: ctx.params.id }]
      : [];
    const remove = removeChannelIds?.length
      ? [{ channel_ids: removeChannelIds, channel_section_id: ctx.params.id }]
      : [];
    return mutate(
      "users.channelSections.channels.bulkUpdate",
      {
        insert: JSON.stringify(insert),
        remove: JSON.stringify(remove),
      },
      ctx,
    );
  }),

  route("POST", "channels/:id/star", (ctx) => mutate("stars.add", { channel: ctx.params.id }, ctx)),

  route("DELETE", "channels/:id/star", (ctx) =>
    mutate("stars.remove", { channel: ctx.params.id }, ctx),
  ),

  route("PUT", "preferences/channel-sections", async (ctx) => {
    const { sections } = await ctx.body.json<{
      sections?: Record<string, Record<string, unknown>>;
    }>();
    if (!sections) return errorResponse("invalid_sections", 400);
    return prefWrite("channel_sections", JSON.stringify(sections), ctx);
  }),
];

function trimSections(data: ChannelSectionsReply): BootstrapPayload {
  const sections: Record<string, BootstrapSection> = {};
  for (const section of data.channel_sections ?? []) {
    const id = section.channel_section_id ?? section.id;
    if (!id) continue;
    sections[id] = {
      channel_ids: section.channel_ids ?? section.channel_ids_page?.channel_ids ?? section.channels,
      filtering: section.sidebar,
      name: section.name,
      type: section.type,
    };
  }
  return { sections };
}

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
  ctx.add(
    "bootstrap.part",
    slackPart<ChannelSectionsReply>("sections", "users.channelSections.list", trimSections),
  );
};

export default setup;

type ChannelSectionsReply = { channel_sections?: RawChannelSection[] };

type CreatedSectionReply = RawChannelSection & { channel_section?: RawChannelSection };

function trimChannelSection(section: RawChannelSection): RawChannelSection {
  return {
    channel_ids: section.channel_ids,
    channel_ids_page: section.channel_ids_page
      ? { channel_ids: section.channel_ids_page.channel_ids }
      : undefined,
    channel_section_id: section.channel_section_id,
    channels: section.channels,
    id: section.id,
    name: section.name,
    sidebar: section.sidebar,
    type: section.type,
  };
}
