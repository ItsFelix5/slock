import { tokenizeShell } from "./shellTokens";

export type SlackRequest = {
  url: string;
  headers: Map<string, string>;
  cookie: string;
  body: string;
};

const URL_TOKEN = /^https?:\/\//i;
const HEADER_FLAGS = new Set(["-H", "--header"]);
const COOKIE_FLAGS = new Set(["-b", "--cookie"]);
const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-ascii"]);
const URL_FLAGS = new Set(["--url"]);
const OTHER_VALUE_FLAGS = new Set([
  "-A",
  "-e",
  "-m",
  "-o",
  "-u",
  "-w",
  "-x",
  "-F",
  "-K",
  "-T",
  "-X",
  "--cacert",
  "--cert",
  "--config",
  "--connect-timeout",
  "--form",
  "--key",
  "--max-time",
  "--output",
  "--proxy",
  "--referer",
  "--request",
  "--resolve",
  "--retry",
  "--upload-file",
  "--user",
  "--user-agent",
  "--write-out",
]);
const SHORT_FLAGS_WITH_ATTACHED_VALUE = ["-H", "-b", "-d"];

function splitAttached(token: string): [string, string | undefined] {
  const short = SHORT_FLAGS_WITH_ATTACHED_VALUE.find(
    (flag) => token.startsWith(flag) && token.length > flag.length && !token.startsWith("--"),
  );
  return short ? [short, token.slice(short.length)] : [token, undefined];
}

export function parseCurlRequest(raw: string): SlackRequest {
  const tokens = tokenizeShell(raw);
  const request: SlackRequest = { body: "", cookie: "", headers: new Map(), url: "" };
  const bodies: string[] = [];
  const cookies: string[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const [flag, attached] = splitAttached(tokens.at(index) ?? "");
    const takesValue =
      HEADER_FLAGS.has(flag) ||
      COOKIE_FLAGS.has(flag) ||
      DATA_FLAGS.has(flag) ||
      URL_FLAGS.has(flag) ||
      OTHER_VALUE_FLAGS.has(flag);
    if (!takesValue) {
      if (!request.url && URL_TOKEN.test(flag)) request.url = flag;
      continue;
    }
    const value = attached ?? tokens.at(++index) ?? "";
    if (HEADER_FLAGS.has(flag)) {
      const colon = value.indexOf(":");
      if (colon > 0) {
        const name = value.slice(0, colon).trim().toLowerCase();
        const headerValue = value.slice(colon + 1).trim();
        if (name === "cookie") cookies.push(headerValue);
        else request.headers.set(name, headerValue);
      }
    } else if (COOKIE_FLAGS.has(flag)) cookies.push(value);
    else if (DATA_FLAGS.has(flag)) bodies.push(value);
    else if (URL_FLAGS.has(flag) && URL_TOKEN.test(value)) request.url ||= value;
  }

  request.cookie = cookies.join("; ");
  request.body = bodies.join("&");
  return request;
}
