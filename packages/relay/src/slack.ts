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
