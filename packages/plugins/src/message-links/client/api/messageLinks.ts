import { service } from "@slock/core/solid";
import { getChannelLink, getPermalink } from "@slock/plugins/slack/client/api";
import type { ChannelId, FileId, Ts } from "@slock/types";

const feedback = service("feedback");

export async function copyMessageLink(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
  try {
    const link = await getPermalink(channelId, ts, threadTs);
    if (!link) throw new Error("no permalink");
    await navigator.clipboard.writeText(link);
  } catch (err) {
    console.error("Failed to get permalink", err);
    feedback.flash(ts, "Couldn't copy the message link.", "error");
  }
}

export async function copyChannelLink(channelId: ChannelId) {
  try {
    const link = await getChannelLink(channelId);
    if (!link) throw new Error("no channel link");
    await navigator.clipboard.writeText(link);
  } catch (err) {
    console.error("Failed to copy channel link", err);
    feedback.flash(channelId, "Couldn't copy the link.", "error");
  }
}

export async function copyCanvasLink(fileId: FileId, permalink: string | null) {
  try {
    if (!permalink) throw new Error("no permalink");
    await navigator.clipboard.writeText(permalink);
  } catch (err) {
    console.error("Failed to copy canvas link", err);
    feedback.flash(fileId, "Couldn't copy the canvas link.", "error");
  }
}

export async function prepareReplyLink(
  channelId: ChannelId,
  ts: Ts,
  threadTs?: Ts,
): Promise<string | null> {
  try {
    return await getPermalink(channelId, ts, threadTs);
  } catch (err) {
    console.error("Failed to get permalink", err);
    return null;
  }
}
