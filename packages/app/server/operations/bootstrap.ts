// biome-ignore-all lint/style/useNamingConvention: Slack payloads retain their wire field names.

import { type Credentials, jsonHeaders } from "../auth.ts";
import { compressedResponse } from "../http/compressedResponse.ts";

type SlackCaller = (
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
) => Promise<any>;

// These calls seed account-wide state used throughout the mounted shell. They are
// one app-level bootstrap operation; view-specific data such as sections, history,
// pins and drafts deliberately stays out and is loaded only by its owning view.
export async function bootstrapResponse(
  creds: Credentials | null,
  callSlack: SlackCaller,
  acceptEncoding: string | null,
  includeSections: boolean,
): Promise<Response> {
  const [boot, counts, prefs, dnd, sections] = await Promise.all([
    callSlack("client.userBoot", {}, creds),
    callSlack("client.counts", {}, creds).catch(() => ({ ok: false })),
    callSlack("users.prefs.get", {}, creds),
    callSlack("dnd.info", {}, creds),
    includeSections
      ? callSlack("users.channelSections.list", {}, creds)
      : Promise.resolve(undefined),
  ]);
  return compressedResponse(
    JSON.stringify({ boot, counts, dnd, prefs, sections }),
    jsonHeaders,
    acceptEncoding,
  );
}
