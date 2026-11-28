import { replyError } from "@slock/slack";
import { apiPost } from "@slock/slack/client";

export async function reportChannelNamesToFlaron(names: string[]): Promise<void> {
  const data = await apiPost("/api/channels/flaron-report", { names });
  if (!data.ok) throw replyError(data, "flaron-report failed");
}
