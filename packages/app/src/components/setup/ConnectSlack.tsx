import { submitAuthRequest } from "@slock/slack-api";
import { createSignal } from "solid-js";
import "./ConnectSlack.css";

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

// Multipart bodies (file uploads, e.g. files.completeUploadExternal) contain
// real CRLFs, which devtools represents as literal `\r\n` escape sequences
// whether the copy format is bash's ANSI-C `$'...'` quoting or a JS string
// literal — unlike unescapeJs, this has to turn those back into actual
// control characters rather than just stripping the backslash.
function unescapeControlChars(value: string): string {
  return value.replace(/\\(r|n|t|\\|"|')/g, (_, c: string) => {
    if (c === "r") return "\r";
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    return c === "\\" ? "\\" : c;
  });
}

function extractBoundary(text: string, unescapedBody: string): string | undefined {
  const headerBoundary = firstMatch(text, [
    /-H\s*['"]content-type:[^'"]*boundary=([^\s'";]+)['"]/i,
    /"content-type":\s*"[^"]*boundary=([^"\\]+)"/i,
  ]);
  if (headerBoundary) return headerBoundary;
  // Fall back to sniffing the body itself: its first line is always `--<boundary>`.
  const firstLine = unescapedBody.split(/\r?\n/)[0] ?? "";
  return firstLine.match(/^-{2,}(.+)$/)?.[1];
}

function extractMultipartField(
  body: string,
  boundary: string,
  fieldName: string,
): string | undefined {
  for (const part of body.split(`--${boundary}`)) {
    const disposition = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"/i);
    if (disposition?.[1] !== fieldName) continue;
    const sepIndex = part.indexOf("\r\n\r\n");
    const valueStart = sepIndex !== -1 ? sepIndex + 4 : part.indexOf("\n\n") + 2;
    if (valueStart <= 0) continue;
    return part
      .slice(valueStart)
      .replace(/\r?\n--$/, "")
      .trim();
  }
  return undefined;
}

export default function ConnectSlack(props: { onConnected: () => void }) {
  const [error, setError] = createSignal<string | null>(null);

  async function validate(raw: string) {
    if (!raw.trim()) return;
    setError(null);

    try {
      const text = raw
        .trim()
        .replace(/\\\r?\n/g, " ")
        .replace(/\^\r?\n/g, " ")
        .replace(/`\r?\n/g, " ");

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
        if (/content-disposition/i.test(bodyRaw)) {
          // multipart/form-data (e.g. files.completeUploadExternal) — "Content-
          // Disposition" is never escaped, so its presence is a reliable signal
          // regardless of which devtools copy format produced the body.
          const unescapedBody = unescapeControlChars(bodyRaw);
          const boundary = extractBoundary(text, unescapedBody);
          if (boundary) token = extractMultipartField(unescapedBody, boundary, "token");
        } else {
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

      const result = await submitAuthRequest({ domain, token, cookie: cookie.trim(), route });
      if (!result.ok) throw result.error;
      props.onConnected();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div class="connect-slack">
      <div class="connect-slack-card">
        <h1>Connect to Slack</h1>
        <p class="connect-slack-intro">
          Slock needs a token and session cookie from a signed-in Slack tab. Grab both at once by
          copying a request out of devtools:
        </p>
        <ol class="connect-slack-steps">
          <li>Open Slack in your browser and sign in.</li>
          <li>Open devtools → the Network tab, then click around (e.g. switch channels).</li>
          <li>
            Right-click any request to <code>/api/...</code> → Copy → <strong>Copy as cURL</strong>.
          </li>
          <li>Paste it below.</li>
        </ol>
        <textarea
          class="connect-slack-input"
          placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
          onInput={(e) => validate(e.currentTarget.value)}
          spellcheck={false}
          rows={8}
        />
        {error() && <p class="connect-slack-error">{error()}</p>}
      </div>
    </div>
  );
}
