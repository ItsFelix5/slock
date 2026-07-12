import { addReminder, getPermalink } from "@slock/slack-api";

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
  } catch (err) {
    console.error("Failed to get permalink", err);
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
  } catch (err) {
    console.error("Failed to set reminder", err);
  }
}
