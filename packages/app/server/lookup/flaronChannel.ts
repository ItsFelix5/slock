// biome-ignore-all lint/style/useNamingConvention: Flaron mirrors Slack identifiers and metadata.
const CHANNEL_ID_RE = /^[A-Z][A-Z0-9]{1,31}$/;

export type ChannelLookup = {
  id: string;
  name: string;
  private: boolean;
  topic: string;
};

type Requester = (url: string, init?: RequestInit) => Promise<Response>;

export async function lookupFlaronChannel(
  id: string,
  request: Requester = fetch,
): Promise<ChannelLookup | null> {
  if (!CHANNEL_ID_RE.test(id)) return null;
  try {
    const response = await request(`https://flaron.halceon.dev/channel/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!(response.ok && response.headers.get("content-type")?.includes("application/json")))
      return null;
    const data = (await response.json()) as {
      counts?: unknown;
      id?: unknown;
      name?: unknown;
      topic?: unknown;
    };
    if (typeof data?.name !== "string" || !data.name) return null;
    return {
      id: typeof data.id === "string" ? data.id : id,
      name: data.name,
      private: !data.counts,
      topic: typeof data.topic === "string" ? data.topic : "",
    };
  } catch {
    return null;
  }
}

export async function flaronChannelResponse(id: string | null): Promise<Response> {
  if (!id) return new Response("missing id", { status: 400 });
  const channel = await lookupFlaronChannel(id);
  return channel
    ? Response.json(channel, { headers: { "cache-control": "private, max-age=300" } })
    : new Response("channel not found", { status: 404 });
}
