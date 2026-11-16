export type SlackFailure = { error: string; ok: false };
export type SlackReply<T extends object = object> = (T & { ok: true }) | SlackFailure;

const botTokens: Record<string, string> = JSON.parse(Bun.env.SLACK_BOT_TOKENS ?? "{}");

export function hasWorkspace(team: string) {
  return team in botTokens;
}

function failure(error: unknown): SlackFailure {
  return { error: error instanceof Error ? error.message : "request_failed", ok: false };
}

export async function callBot<T extends object = object>(
  team: string,
  method: string,
  params: Record<string, string>,
): Promise<SlackReply<T>> {
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      body: new URLSearchParams(params),
      headers: { authorization: `Bearer ${botTokens[team]}` },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    return JSON.parse(await res.text());
  } catch (error) {
    return failure(error);
  }
}

async function sendBytes(uploadUrl: string, file: File): Promise<SlackFailure | undefined> {
  try {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await fetch(uploadUrl, {
      body: form,
      method: "POST",
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return { error: `upload_failed_${res.status}`, ok: false };
  } catch (error) {
    return failure(error);
  }
}

async function reserveAndSend(team: string, file: File) {
  const reserved = await callBot<{ file_id: string; upload_url: string }>(
    team,
    "files.getUploadURLExternal",
    { filename: file.name, length: String(file.size) },
  );
  if (!reserved.ok) return reserved;
  return (
    (await sendBytes(reserved.upload_url, file)) ?? { id: reserved.file_id, ok: true as const }
  );
}

export async function uploadBotFiles(
  team: string,
  files: File[],
): Promise<SlackReply<{ ids: string[] }>> {
  const uploaded: { id: string; title: string }[] = [];
  for (const file of files) {
    const sent = await reserveAndSend(team, file);
    if (!sent.ok) return sent;
    uploaded.push({ id: sent.id, title: file.name });
  }
  const completed = await callBot(team, "files.completeUploadExternal", {
    files: JSON.stringify(uploaded),
  });
  return completed.ok ? { ids: uploaded.map((file) => file.id), ok: true } : completed;
}
