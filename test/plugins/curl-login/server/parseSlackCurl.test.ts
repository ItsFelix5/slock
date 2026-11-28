import { describe, expect, test } from "bun:test";
import { parseSlackCurl } from "../../../../packages/plugins/src/curl-login/server/parseSlackCurl";
import { forAll, int, pick, type Random, text } from "../../../support/core";

const SESSION_ALPHABET = "abcXYZ019-_%+/=$'\"\\&!";
const TOKEN_ALPHABET = "abcdefXYZ0123456789-";

type Style = "single" | "double" | "ansi" | "cmd" | "multiline";
type BodyKind = "form" | "json" | "multipart" | "url";

const posixSingle = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
const posixDouble = (value: string) => `"${value.replace(/[\\"$`]/g, "\\$&")}"`;
const ansi = (value: string) =>
  `$'${value.replace(/[\\']/g, "\\$&").replaceAll("\n", "\\n").replaceAll("\r", "\\r")}'`;
const cmd = (value: string) =>
  `^"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/[\^&<>|%"]/g, "^$&")}^"`;

const QUOTERS: Record<Style, (value: string) => string> = {
  ansi,
  cmd,
  double: posixDouble,
  multiline: posixSingle,
  single: posixSingle,
};

type Spec = {
  body: BodyKind;
  domain: string;
  route: string;
  session: string;
  style: Style;
  token: string;
  cookieFlag: "-b" | "--cookie" | "header";
};

function randomSpec(random: Random): Spec {
  return {
    body: pick(random, ["form", "json", "multipart", "url"] as const),
    cookieFlag: pick(random, ["-b", "--cookie", "header"] as const),
    domain: `${pick(random, ["acme", "a-b", "x1"])}.${pick(random, ["slack.com", "enterprise.slack.com"])}`,
    route: `T${int(random, 1, 999)}:E${int(random, 1, 999)}`,
    session: `xoxd-${text(random, SESSION_ALPHABET, 40)}x`,
    style: pick(random, ["single", "double", "ansi", "cmd", "multiline"] as const),
    token: `xoxc-${text(random, TOKEN_ALPHABET, 40)}`,
  };
}

function bodyFor(spec: Spec): string {
  if (spec.body === "json") return JSON.stringify({ channel: "C1", token: spec.token });
  if (spec.body === "form") return `channel=C1&token=${encodeURIComponent(spec.token)}&x=1`;
  const fields = [
    ["channel", "C1"],
    ["token", spec.token],
    ["x", "y z"],
  ] as const;
  const boundary = "----WebKitFormBoundaryAbC123";
  const parts = fields.map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  return `${parts.join("")}--${boundary}--\r\n`;
}

function render(spec: Spec): string {
  const quote = QUOTERS[spec.style];
  const query = `slack_route=${spec.route}&_x_id=abc${spec.body === "url" ? `&token=${spec.token}` : ""}`;
  const args = [
    `curl ${quote(`https://${spec.domain}/api/conversations.history?${query}`)}`,
    `-H ${quote("accept: */*")}`,
    spec.cookieFlag === "header"
      ? `-H ${quote(`Cookie: lc=1; d=${spec.session}; b=2`)}`
      : `${spec.cookieFlag} ${quote(`lc=1; d=${spec.session}; b=2`)}`,
    `-H ${quote("referer: https://app.slack.com/")}`,
    ...(spec.body === "url"
      ? []
      : [
          ...(spec.body === "multipart"
            ? [
                `-H ${quote("content-type: multipart/form-data; boundary=----WebKitFormBoundaryAbC123")}`,
              ]
            : []),
          `--data-raw ${(spec.style === "single" || spec.style === "multiline" ? ansi : quote)(bodyFor(spec))}`,
        ]),
    "--compressed",
  ];
  if (spec.style === "multiline") return args.join(" \\\n  ");
  if (spec.style === "cmd") return args.join(" ^\n  ");
  return args.join(" ");
}

function expected(spec: Spec) {
  return {
    domain: spec.domain,
    route: spec.route,
    slackSession: spec.session,
    token: spec.token,
  };
}

describe("round trip across quoting styles", () => {
  test("every style and body kind yields the original credentials", () => {
    forAll(randomSpec, (spec) => expect(parseSlackCurl(render(spec))).toEqual(expected(spec)), 600);
  });
});

describe("chrome shapes", () => {
  const session = "xoxd-abc%2Bdef%2F";
  const cookie = `lc=1; d=${session}; d-s=17`;
  const url = "https://acme.slack.com/api/conversations.view?_x_id=1&slack_route=T1%3AT1";

  test("bash with $'' multipart body and CRLF", () => {
    const body =
      '------WebKitFormBoundaryQ\\r\\nContent-Disposition: form-data; name="token"\\r\\n\\r\\nxoxc-1-2\\r\\n------WebKitFormBoundaryQ--\\r\\n';
    const input = `curl '${url}' \\\n  -H 'cookie: ${cookie}' \\\n  --data-raw $'${body}'`;
    expect(parseSlackCurl(input)).toMatchObject({ route: "T1:T1", token: "xoxc-1-2" });
  });

  test("multipart body with bare LF line endings and no content-type header", () => {
    const body = '--B\nContent-Disposition: form-data; name="token"\n\nxoxc-9\n--B--\n';
    const input = `curl '${url}' -b '${cookie}' --data-raw '${body}'`;
    expect(parseSlackCurl(input).token).toBe("xoxc-9");
  });

  test("windows cmd with escaped json body", () => {
    const input = [
      `curl ^"${url.replace("&", "^&")}^" ^`,
      `  -H ^"cookie: ${cookie}^" ^`,
      `  --data-raw ^"{^\\^"token^\\^":^\\^"xoxc-5^\\^",^\\^"a^\\^":1}^"`,
    ].join("\n");
    expect(parseSlackCurl(input)).toMatchObject({ slackSession: session, token: "xoxc-5" });
  });

  test("copy as fetch", () => {
    const input = `fetch("${url}", {\n  "headers": {"cookie": "${cookie}", "content-type": "application/x-www-form-urlencoded"},\n  "body": "token=xoxc-7&x=%22",\n  "method": "POST"\n});`;
    expect(parseSlackCurl(input)).toMatchObject({ slackSession: session, token: "xoxc-7" });
  });

  test("short flags attached to values and mixed case headers", () => {
    const input = `curl '${url}' -H'Cookie:${cookie}' -d'token=xoxc-3' -sSL -X POST -e 'https://app.slack.com/'`;
    expect(parseSlackCurl(input)).toMatchObject({ token: "xoxc-3" });
  });

  test("url from --url and referer is never mistaken for the target", () => {
    const input = `curl -e 'https://evil.example/' --url '${url}' -b '${cookie}' -d 'token=xoxc-4'`;
    expect(parseSlackCurl(input).domain).toBe("acme.slack.com");
  });

  test("repeated data flags join with &", () => {
    const input = `curl '${url}' -b '${cookie}' -d 'a=1' --data 'token=xoxc-8'`;
    expect(parseSlackCurl(input).token).toBe("xoxc-8");
  });

  test("the first d cookie with a valid value wins", () => {
    const input = `curl '${url}' -b 'd=bad; d=${session}' -d 'token=xoxc-2'`;
    expect(parseSlackCurl(input).slackSession).toBe(session);
  });
});

describe("failures", () => {
  const secret = "xoxc-SECRET-TOKEN";
  const session = "xoxd-SECRET-SESSION";
  const url = "https://acme.slack.com/api/x?slack_route=T1";
  const cookie = `-b 'd=${session}'`;
  const failing: [string, string, RegExp][] = [
    ["empty", "", /URL/],
    ["no url", `-b 'd=${session}' -d 'token=${secret}'`, /URL/],
    ["broken url with token", `curl 'https://[x/?token=${secret}' ${cookie}`, /URL/],
    ["no cookie", `curl '${url}' -d 'token=${secret}'`, /cookie header/],
    ["cookie without d", `curl '${url}' -b 'a=b' -d 'token=${secret}'`, /d session cookie/],
    ["bad session prefix", `curl '${url}' -b 'd=${secret}' -d 'token=${secret}'`, /d session/],
    ["no token", `curl '${url}' ${cookie} -d 'x=1'`, /token/],
    ["json token is not a string", `curl '${url}' ${cookie} -d '{"token":5}'`, /token/],
    ["json is broken", `curl '${url}' ${cookie} -d '{"token":"${secret}"'`, /token/],
    [
      "multipart without token",
      `curl '${url}' ${cookie} -d $'--B\\r\\nContent-Disposition: form-data; name="a"\\r\\n\\r\\n${secret}\\r\\n--B--'`,
      /token/,
    ],
    [
      "no route",
      `curl 'https://acme.slack.com/api/x' ${cookie} -d 'token=${secret}'`,
      /slack_route/,
    ],
  ];

  for (const [name, input, pattern] of failing) {
    test(name, () => {
      let message = "";
      try {
        parseSlackCurl(input);
      } catch (error) {
        message = error instanceof Error ? error.message : "";
      }
      expect(message).toMatch(pattern);
      expect(message).not.toContain(secret);
      expect(message).not.toContain(session);
    });
  }

  test("garbage only ever fails with a fixed message", () => {
    const knownMessages = new Set(
      failing.map(([, input]) => {
        try {
          parseSlackCurl(input);
        } catch (error) {
          return error instanceof Error ? error.message : "";
        }
        return "";
      }),
    );
    forAll(
      (random) => text(random, "curl-H'\"\\$^ \n:/&?=%{}xoxcd;b", 80),
      (input) => {
        try {
          parseSlackCurl(input);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(knownMessages.has((error as Error).message)).toBe(true);
        }
      },
      500,
    );
  });
});
