// The browser can't call Slack directly (no way to attach the session cookie
// Slack's internal API requires — see server.ts), so every Slack method call
// is relayed through our own minimal same-origin server instead.
export async function callSlack(method: string, params: Record<string, string> = {}): Promise<any> {
  const res = await fetch(`/slack/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

// Same relay, but for Slack's Edge API cache service — a different host with
// JSON params (arrays allowed), used where Enterprise Grid blocks the regular
// Web API method (e.g. channel membership).
export async function callSlackEdge(
  method: string,
  params: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch(`/slack-edge/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

// A Slack file's url_private/thumb URLs require the session cookie to fetch,
// which only the server holds — this routes the browser's <img>/<a> requests
// through our own proxy instead of hotlinking Slack directly.
export function fileProxyUrl(url: string): string {
  return `/file?url=${encodeURIComponent(url)}`;
}

// The workspace domain (e.g. "hackclub.slack.com") only lives in the
// server's env — fetched once and cached, since it never changes at runtime.
let workspaceDomain: Promise<string> | null = null;
export function getWorkspaceDomain(): Promise<string> {
  if (!workspaceDomain) {
    workspaceDomain = fetch("/config")
      .then((res) => res.json())
      .then((data) => data.domain as string)
      .catch((err) => {
        workspaceDomain = null;
        throw err;
      });
  }
  return workspaceDomain;
}

// Unlike getWorkspaceDomain, this is never cached — it's polled by the
// connect-to-slack screen while waiting for the server to have credentials.
export async function getConfig(): Promise<{ domain: string | null; configured: boolean }> {
  const res = await fetch("/config");
  return res.json();
}

// Submits a request pasted from devtools (see server/parse-auth-request.ts)
// so the relay can extract a token/cookie/route from it.
export async function submitAuthRequest(raw: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  return res.json();
}
