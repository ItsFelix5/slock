const CHANNEL_ID_RE = /^[A-Z][A-Z0-9]{1,31}$/;

export type ChannelLookup = {
  id: string;
  name: string;
  private: boolean;
  topic: string;
};

type Requester = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchFlaronChannel(
  value: string,
  request: Requester,
): Promise<ChannelLookup | null> {
  try {
    const response = await request(
      `https://flaron.halceon.dev/channel/${encodeURIComponent(value)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!(response.ok && response.headers.get("content-type")?.includes("application/json")))
      return null;
    const data: any = await response.json();
    if (typeof data?.name !== "string" || !data.name) return null;
    return {
      id: typeof data.id === "string" ? data.id : value,
      name: data.name,
      private: !data.counts,
      topic: typeof data.topic === "string" ? data.topic : "",
    };
  } catch {
    return null;
  }
}

export async function lookupFlaronChannel(
  id: string,
  request: Requester = fetch,
): Promise<ChannelLookup | null> {
  if (!CHANNEL_ID_RE.test(id)) return null;
  return fetchFlaronChannel(id, request);
}

export async function reportFlaronChannelNames(
  names: string[],
  request: Requester = fetch,
): Promise<void> {
  await request("https://flaron.halceon.dev/cnames", {
    body: JSON.stringify(names),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
}
