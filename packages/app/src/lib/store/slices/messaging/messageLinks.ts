import { addReminder, getPermalink } from "@slock/slack-api";
import { actionFeedback } from "../feedback";

export const REMINDER_OPTIONS: { label: string; time: string }[] = [
  { label: "in 20 minutes", time: "in 20 minutes" },
  { label: "in 1 hour", time: "in 1 hour" },
  { label: "in 3 hours", time: "in 3 hours" },
  { label: "tomorrow", time: "tomorrow at 9am" },
  { label: "next week", time: "next monday at 9am" },
];

export async function copyMessageLink(channelId: string, ts: string) {
  try {
    const link = await getPermalink(channelId, ts);
    if (!link) throw new Error("no permalink");
    await navigator.clipboard.writeText(link);
    actionFeedback.flash(ts, "Link copied to clipboard.");
  } catch (err) {
    console.error("Failed to get permalink", err);
    actionFeedback.flash(ts, "Failed to copy link.", "error");
  }
}

export async function prepareReplyLink(
  channelId: string,
  ts: string,
  threadTs?: string,
): Promise<string | null> {
  try {
    return await getPermalink(channelId, ts, threadTs);
  } catch (err) {
    console.error("Failed to get permalink", err);
    return null;
  }
}

export async function remindAboutMessage(channelId: string, ts: string, time: string) {
  try {
    const link = await getPermalink(channelId, ts);
    await addReminder(link ?? `message ${ts} in ${channelId}`, time);
    actionFeedback.flash(ts, "I'll remind you about this.");
  } catch (err) {
    console.error("Failed to set reminder", err);
    actionFeedback.flash(ts, "Failed to set reminder.", "error");
  }
}
