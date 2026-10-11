import { apiPost } from "@slock/slack";

export async function reportChannelNamesToFlaron(names: string[]): Promise<void> {
  const data = await apiPost("/api/channels/flaron-report", { names });
  if (!data.ok) throw new Error(data.error ?? "flaron-report failed");
}
