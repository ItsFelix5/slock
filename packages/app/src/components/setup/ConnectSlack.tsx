import { createSignal } from "solid-js";
import { extractSlackSession, submitAuthRequest } from "../../lib/api";
import "./ConnectSlack.css";

const CONTENT_TYPE_BOUNDARY_CURL = /-H\s*['"]content-type:[^'"]*boundary=([^\s'";]+)['"]/i;
const CONTENT_TYPE_BOUNDARY_JSON = /"content-type":\s*"[^"]*boundary=([^"\\]+)"/i;
const NEWLINE_SPLIT = /\r?\n/;
// A multipart separator line is always exactly "--" + the boundary value -
// this must NOT be greedy about leading dashes, since Firefox's own
// generated boundary values (e.g. "----geckoformboundary...") commonly
// start with more dashes themselves. Eating those extra dashes here makes
// every later `--${boundary}` split miss them, leaving stray dashes stuck
// onto every extracted field value.
const BOUNDARY_MARKER = /^--(.+)$/;
const UNESCAPE_CONTROL = /\\(r|n|t|\\|"|')/g;
const FORM_DATA_DISPOSITION = /Content-Disposition:\s*form-data;\s*name="([^"]+)"/i;
const CONTINUATION_JOIN = /\\\r?\n/g;
const CARET_JOIN = /\^\r?\n/g;
const BACKTICK_JOIN = /`\r?\n/g;
const URL_MATCH = /https?:\/\/[^\s'"\\]+/;
const MULTIPART_FIELD_END = /\r?\n--$/;
const CURL_B_SINGLE = /-b\s+'([^']*)'/;
const CURL_B_DOUBLE = /-b\s+"([^"]*)"/;
const CURL_COOKIE = /-H\s*['"]cookie:\s*([^'"]*)['"]/i;
const JSON_COOKIE = /"cookie":\s*"([^"]*)"/i;
const DATA_CURL_SINGLE = /--data(?:-raw|-binary)?\s+\$?'((?:[^'\\]|\\.)*)'/;
const DATA_CURL_DOUBLE = /--data(?:-raw|-binary)?\s+"((?:[^"\\]|\\.)*)"/;
const DATA_D = /-d\s+'((?:[^'\\]|\\.)*)'/;
const DATA_JSON = /"body":\s*"((?:[^"\\]|\\.)*)"/;
const CONTENT_DISP = /content-disposition/i;

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = text.match(pattern)?.[1];
    if (found !== undefined) return found;
  }
}

function unescapeJs(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

function unescapeControlCharsImpl(value: string): string {
  return value.replace(UNESCAPE_CONTROL, (_, c: string) => {
    if (c === "r") return "\r";
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    return c === "\\" ? "\\" : c;
  });
}

function extractBoundary(text: string, unescapedBody: string): string | undefined {
  const headerBoundary = firstMatch(text, [CONTENT_TYPE_BOUNDARY_CURL, CONTENT_TYPE_BOUNDARY_JSON]);
  if (headerBoundary) return headerBoundary;
  const firstLine = unescapedBody.split(NEWLINE_SPLIT)[0] ?? "";
  return firstLine.match(BOUNDARY_MARKER)?.[1];
}

function extractMultipartField(
  body: string,
  boundary: string,
  fieldName: string,
): string | undefined {
  for (const part of body.split(`--${boundary}`)) {
    const disposition = part.match(FORM_DATA_DISPOSITION);
    if (disposition?.[1] !== fieldName) continue;
    const sepIndex = part.indexOf("\r\n\r\n");
    const valueStart = sepIndex === -1 ? part.indexOf("\n\n") + 2 : sepIndex + 4;
    if (valueStart <= 0) continue;
    return part.slice(valueStart).replace(MULTIPART_FIELD_END, "").trim();
  }
}

export default function ConnectSlack(props: { onConnected: () => void }) {
  const [error, setError] = createSignal<string | null>(null);

  async function connect(raw: string) {
    try {
      const text = raw
        .trim()
        .replace(CONTINUATION_JOIN, " ")
        .replace(CARET_JOIN, " ")
        .replace(BACKTICK_JOIN, " ");

      const urlMatch = text.match(URL_MATCH);
      if (!urlMatch) throw new Error("Couldn't find a URL in that.");
      const url = new URL(urlMatch[0]);
      const domain = url.hostname;

      const cookie = firstMatch(text, [CURL_B_SINGLE, CURL_B_DOUBLE, CURL_COOKIE, JSON_COOKIE]);
      if (!cookie) {
        throw new Error(
          "Couldn't find a cookie header. Make sure devtools copied the request with headers included (Copy as cURL includes them by default).",
        );
      }
      const slackSession = extractSlackSession(cookie);
      if (!slackSession) {
        throw new Error("Couldn't find Slack's d session cookie in that request.");
      }

      const bodyRaw = firstMatch(text, [DATA_CURL_SINGLE, DATA_CURL_DOUBLE, DATA_D, DATA_JSON]);

      let token = url.searchParams.get("token") ?? undefined;
      if (!token && bodyRaw) {
        if (CONTENT_DISP.test(bodyRaw)) {
          const unescapedBody = unescapeControlCharsImpl(bodyRaw);
          const boundary = extractBoundary(text, unescapedBody);
          if (boundary) token = extractMultipartField(unescapedBody, boundary, "token");
        } else {
          const body = unescapeJs(bodyRaw);
          if (body.trim().startsWith("{")) {
            try {
              ({ token } = JSON.parse(body));
            } catch {}
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

      const result = await submitAuthRequest({ domain, route, slackSession, token });
      if (!result.ok) throw result.error;
      props.onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="connect-slack flex-center">
      <div class="connect-slack-card">
        <h1>Connect to Slack</h1>
        <p class="connect-slack-intro" id="connect-slack-instructions">
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
          aria-describedby="connect-slack-instructions connect-slack-error"
          autocomplete="off"
          class="connect-slack-input"
          onInput={(event) => {
            setError(null);
            connect(event.currentTarget.value);
          }}
          placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
          rows={8}
          spellcheck={false}
        />
        <p class="connect-slack-error" id="connect-slack-error">
          {error()}
        </p>
      </div>
    </div>
  );
}
