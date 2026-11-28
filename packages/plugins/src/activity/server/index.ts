import type { Setup } from "@slock/core";
import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { Paged, SavedListReply } from "@slock/plugins/slack/server/api/slackReplies";
import { isTs, richTextBlocksToPlainText } from "@slock/slack";
import type { RawActivityFeedEntry } from "@slock/types";
import { ACTIVITY_FEED_TYPES_PARAM } from "../protocol/feedTypes";
import { activityEventTrim, reminderKey, trimActivityItem } from "./trim";

const NO_TS = "0000000000.000000";

async function fetchReminders(
  rawItems: RawActivityFeedEntry[],
  creds: Credentials | null,
): Promise<Map<string, string>> {
  const payloads = [
    ...new Map(
      rawItems.flatMap((raw) =>
        raw.item?.saved_reminder_payload?.item_id
          ? [
              [
                reminderKey(raw.item.saved_reminder_payload),
                raw.item.saved_reminder_payload,
              ] as const,
            ]
          : [],
      ),
    ).values(),
  ];
  const reminders = new Map<string, string>();
  if (payloads.length === 0) return reminders;
  const data = await callSlack<SavedListReply>(
    "saved.get",
    {
      items: JSON.stringify(
        payloads.map((payload) => ({
          item_id: payload.item_id,
          item_detail: "",
          item_type: payload.item_type,
          ts: payload.item_id_2,
        })),
      ),
    },
    creds,
  );
  if (!data.ok) return reminders;
  for (const savedItem of data.saved_items ?? []) {
    if (!(savedItem.item_id && savedItem.description)) continue;
    const text = richTextBlocksToPlainText(savedItem.description, creds?.domain ?? null);
    if (text)
      reminders.set(
        reminderKey({
          item_id: savedItem.item_id,
          item_id_2: savedItem.ts ?? savedItem.message_ts ?? NO_TS,
        }),
        text,
      );
  }
  return reminders;
}

const list: Route[] = [
  route("POST", "activity/archive", async (ctx) => {
    const { key, linkedItemId, ts, type } = await ctx.body.json<{
      key?: string;
      linkedItemId?: string;
      ts?: string;
      type?: string;
    }>();
    if (!(key && type && ts && isTs(ts))) return errorResponse("invalid_activity_entry", 400);
    if (type === "saved_reminder" && linkedItemId) {
      const done = await callSlack(
        "saved.update",
        {
          date_due: "0",
          item_id: linkedItemId,
          item_type: "reminder",
          mark: "completed",
          todo_state: "completed",
        },
        ctx.creds,
      );
      if (!done.ok) return slackErrorResponse(done, "saved.update");
    }
    return mutate("activity.archive", { key, ts, type }, ctx);
  }),

  route("POST", "activity/read", async (ctx) => {
    const { feedTs, key, type } = await ctx.body.json<{
      feedTs?: string;
      key?: string;
      type?: string;
    }>();
    if (!(key && type && feedTs && isTs(feedTs)))
      return errorResponse("invalid_activity_entry", 400);
    return mutate("activity.markRead", { feed_ts: feedTs, key, type }, ctx);
  }),

  route("GET", "activity", async (ctx) => {
    const limit = ctx.searchParams.get("limit") ?? "50";
    const cursor = ctx.searchParams.get("cursor") ?? undefined;
    const types = ctx.searchParams.get("types") ?? ACTIVITY_FEED_TYPES_PARAM;
    const unreadOnly = ctx.searchParams.get("unreadOnly") === "true";
    const data = await callSlack<ActivityFeedReply>(
      "activity.feed",
      {
        archive_only: "false",
        automations_only: "false",
        exclude_automations: "false",
        is_activity_inbox: "true",
        limit,
        mode: "chrono_v1",
        only_salesforce_channels: "false",
        priority_only: "false",
        types,
        unread_only: unreadOnly ? "true" : "false",
        ...(cursor ? { cursor } : {}),
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "activity.feed");
    const rawItems = data.items ?? [];
    const reminders = await fetchReminders(rawItems, ctx.creds);
    return jsonResponse({
      items: rawItems.map((raw) => trimActivityItem(raw, reminders)),
      ok: true,
      response_metadata: data.response_metadata
        ? { next_cursor: data.response_metadata.next_cursor }
        : undefined,
    });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
  ctx.add("realtime.trim", activityEventTrim);
};

export default setup;

type ActivityFeedReply = Paged & { items?: RawActivityFeedEntry[] };
