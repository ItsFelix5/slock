// Turns a request copied out of devtools (Network tab → right-click a call to
// /api/* → Copy → "Copy as cURL" or "Copy as fetch") into the four values the
// relay needs. Users don't have a token/cookie pair sitting anywhere on their
// filesystem — this is how they actually get one, so it has to tolerate the
// handful of shapes devtools produces (bash cURL, cmd cURL, fetch, Node fetch)
// rather than demanding one exact format.
export type ParsedAuth = { domain: string; token: string; cookie: string; route: string };

function normalizeLineContinuations(text: string): string {
  return text
    .replace(/\\\r?\n/g, " ")
    .replace(/\^\r?\n/g, " ")
    .replace(/`\r?\n/g, " ");
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = text.match(pattern)?.[1];
    if (found !== undefined) return found;
  }
  return undefined;
}

function unescapeJs(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

export function parseDevtoolsRequest(raw: string): ParsedAuth {
  const text = normalizeLineContinuations(raw);

  const urlMatch = text.match(/https?:\/\/[^\s'"\\]+/);
  if (!urlMatch) {
    throw new Error(
      "Couldn't find a URL in that. Paste the whole request — in the Network tab, right-click a call to /api/... and choose Copy > Copy as cURL.",
    );
  }
  const url = new URL(urlMatch[0]);
  const domain = url.hostname;

  const cookie = firstMatch(text, [
    /-b\s+'([^']*)'/,
    /-b\s+"([^"]*)"/,
    /-H\s*['"]cookie:\s*([^'"]*)['"]/i,
    /"cookie":\s*"([^"]*)"/i,
  ]);
  if (!cookie) {
    throw new Error(
      "Couldn't find a cookie header. Make sure devtools copied the request with headers included (Copy as cURL includes them by default).",
    );
  }

  const bodyRaw = firstMatch(text, [
    /--data(?:-raw|-binary)?\s+\$?'((?:[^'\\]|\\.)*)'/,
    /--data(?:-raw|-binary)?\s+"((?:[^"\\]|\\.)*)"/,
    /-d\s+'((?:[^'\\]|\\.)*)'/,
    /"body":\s*"((?:[^"\\]|\\.)*)"/,
  ]);

  let token = url.searchParams.get("token") ?? undefined;
  if (!token && bodyRaw) {
    const body = unescapeJs(bodyRaw);
    if (body.trim().startsWith("{")) {
      try {
        token = JSON.parse(body).token;
      } catch {
        // not valid JSON; fall through to the "no token" error below
      }
    } else {
      token = new URLSearchParams(body).get("token") ?? undefined;
    }
  }
  if (!token) {
    throw new Error("Couldn't find a token (starts with xoxc-) in the request body or URL.");
  }

  const route = url.searchParams.get("slack_route");
  if (!route) {
    throw new Error(
      "Couldn't find slack_route in the URL. Copy a request to a regular /api/... endpoint, not edgeapi.slack.com.",
    );
  }

  return { domain, token, cookie: cookie.trim(), route };
}
