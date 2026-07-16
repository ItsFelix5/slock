import { addMessageReminder, getPermalink } from "@slock/slack-api";

function inMinutes(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

function nextDayAt9am(daysFromNow: number): number {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(9, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function nextMondayAt9am(): number {
  const d = new Date();
  const daysUntilMonday = (1 - d.getDay() + 7) % 7 || 7;
  return nextDayAt9am(daysUntilMonday);
}

export const REMINDER_OPTIONS: { label: string; dateDue: () => number }[] = [
  { dateDue: () => inMinutes(20), label: "in 20 minutes" },
  { dateDue: () => inMinutes(60), label: "in 1 hour" },
  { dateDue: () => inMinutes(180), label: "in 3 hours" },
  { dateDue: () => nextDayAt9am(1), label: "tomorrow" },
  { dateDue: nextMondayAt9am, label: "next week" },
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

export async function remindAboutMessage(channelId: string, ts: string, dateDue: number) {
  try {
    await addMessageReminder(channelId, ts, dateDue);
  } catch (err) {
    console.error("Failed to set reminder", err);
  }
}
