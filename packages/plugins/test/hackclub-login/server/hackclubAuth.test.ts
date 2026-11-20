import { afterEach, beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import {
  type EmailChallenge,
  exchangeEmailCode,
  requestEmailCode,
} from "../../../src/hackclub-login/server/hackclubAuth";
import slack from "../../../src/slack/server/index";

const HC = "https://auth.hackclub.com";
const XOXC = "xoxc-111-222-abcdef";
const XOXD = "xoxd-SessionSecret%2Bvalue";

type Route = (url: URL, init: RequestInit | undefined) => Response;

function respond(
  body: string,
  options: { cookies?: string[]; location?: string; status?: number } = {},
) {
  const headers = new Headers();
  for (const cookie of options.cookies ?? []) headers.append("set-cookie", cookie);
  if (options.location) headers.set("location", options.location);
  return new Response(body, { headers, status: options.status ?? (options.location ? 302 : 200) });
}

const csrfPage = (token: string, extra = "") =>
  `<html><head><meta name="csrf-token" content="${token}"></head><body>${extra}</body></html>`;

function serve(route: Route) {
  const requests: { url: string; method: string; cookie: string | null; body: string }[] = [];
  spyOn(globalThis, "fetch").mockImplementation(((input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({
      body: String(init?.body ?? ""),
      cookie: new Headers(init?.headers).get("cookie"),
      method: init?.method ?? "GET",
      url: url.toString(),
    });
    return Promise.resolve(route(url, init));
  }) as typeof fetch);
  return requests;
}

beforeAll(async () => {
  const host = createHost();
  setHost(host);
  await host.register({ id: "slack", setup: slack });
});

afterEach(() => mock.restore());

function loginRoute(afterPost: Response): Route {
  return (url, init) => {
    if (url.pathname === "/login" && init?.method === "POST") return afterPost;
    if (url.pathname === "/login") return respond(csrfPage("t1"), { cookies: ["_hc=abc; Path=/"] });
    return respond(csrfPage("t2"));
  };
}

describe("requestEmailCode", () => {
  test("rejects obviously bad emails before any request", async () => {
    const requests = serve(() => respond(""));
    await expect(requestEmailCode("nope")).rejects.toThrow("valid email");
    expect(requests).toEqual([]);
  });

  test("returns a challenge for the verify step", async () => {
    const requests = serve(loginRoute(respond("", { location: "/login/tok" })));
    const challenge = await requestEmailCode("me@example.dev");
    expect(challenge).toEqual({
      cookies: [["_hc", "abc"]],
      csrfToken: "t2",
      pageUrl: `${HC}/login/tok`,
      verificationUrl: `${HC}/login/tok/verify`,
    });
    expect(requests[1]?.body).toContain("email=me%40example.dev");
    expect(requests[1]?.cookie).toBe("_hc=abc");
  });

  test("keeps a verify url as is", async () => {
    serve(loginRoute(respond("", { location: "/login/tok/verify" })));
    const challenge = await requestEmailCode("me@example.dev");
    expect(challenge.verificationUrl).toBe(`${HC}/login/tok/verify`);
  });

  test("says so when the account does not exist", async () => {
    serve(loginRoute(respond("", { location: "/signup" })));
    await expect(requestEmailCode("me@example.dev")).rejects.toThrow("No Hack Club account");
  });

  test("shows the flash error from the page", async () => {
    serve(loginRoute(respond(`<div class="banner danger">Too many attempts</div>`)));
    await expect(requestEmailCode("me@example.dev")).rejects.toThrow("Too many attempts");
  });

  test("skips the passkey step", async () => {
    const requests = serve((url, init) => {
      if (url.pathname === "/login/tok/webauthn" && init?.method === "GET")
        return respond(csrfPage("w"));
      if (url.pathname === "/login/tok/webauthn/skip")
        return respond("", { location: "/login/tok/verify" });
      return loginRoute(respond("", { location: "/login/tok/webauthn" }))(url, init);
    });
    const challenge = await requestEmailCode("me@example.dev");
    expect(challenge.verificationUrl).toBe(`${HC}/login/tok/verify`);
    expect(requests.some((r) => r.url.endsWith("/webauthn/skip"))).toBe(true);
  });

  test("a surprise page becomes a short error", async () => {
    serve(loginRoute(respond("", { location: "/somewhere" })));
    await expect(requestEmailCode("me@example.dev")).rejects.toThrow(
      "Can't sign in with an email code",
    );
  });
});

const challenge: EmailChallenge = {
  cookies: [["_hc", "abc"]],
  csrfToken: "t2",
  pageUrl: `${HC}/login/tok`,
  verificationUrl: `${HC}/login/tok/verify`,
};

function verifyRoute(
  overrides: { verify?: Response; clientBody?: string; authTest?: unknown } = {},
): Route {
  return (url, init) => {
    if (url.pathname === "/login/tok/verify")
      return overrides.verify ?? respond("", { location: "/" });
    if (url.host === "auth.hackclub.com" && url.pathname === "/") return respond(csrfPage("home"));
    if (url.pathname === "/saml/idp_initiated/slack")
      return respond(
        `<form action="https://hackclub.enterprise.slack.com/sso/saml"><input type="hidden" name="SAMLResponse" value="abc"></form>`,
      );
    if (url.pathname === "/sso/saml")
      return respond("", {
        cookies: [`d=${XOXD}; Path=/; Secure`],
        location: "https://app.slack.com/ready",
      });
    if (url.pathname === "/ready") return respond("<html>ready</html>");
    if (url.host === "app.slack.com" && url.pathname === "/auth")
      return respond(overrides.clientBody ?? `{"api_token":"${XOXC}"}`);
    if (url.pathname === "/api/auth.test" && init?.method === "POST")
      return Response.json(overrides.authTest ?? { ok: true });
    return respond("unexpected", { status: 404 });
  };
}

describe("exchangeEmailCode", () => {
  test("walks SAML and returns the Slack credentials", async () => {
    const requests = serve(verifyRoute());
    const credentials = await exchangeEmailCode(challenge, "123456");
    expect(credentials).toEqual({
      domain: "hackclub.enterprise.slack.com",
      route: "E09V59WQY1E:E09V59WQY1E",
      slackSession: XOXD,
      token: XOXC,
    });
    expect(requests[0]?.body).toContain("code=123456");
    expect(requests[0]?.cookie).toBe("_hc=abc");
  });

  test("refuses challenges that point anywhere but Hack Club Auth", async () => {
    const requests = serve(verifyRoute());
    for (const verificationUrl of [
      "https://evil.example/login/tok/verify",
      "http://auth.hackclub.com/login/tok/verify",
      "https://auth.hackclub.com.evil.example/verify",
    ])
      await expect(exchangeEmailCode({ ...challenge, verificationUrl }, "1")).rejects.toThrow(
        "Start again",
      );
    await expect(
      exchangeEmailCode({ ...challenge, pageUrl: "https://evil.example/" }, "1"),
    ).rejects.toThrow("Start again");
    expect(requests).toEqual([]);
  });

  test("a rejected code surfaces the banner", async () => {
    serve(verifyRoute({ verify: respond(`<div class="banner danger">Invalid code</div>`) }));
    await expect(exchangeEmailCode(challenge, "000000")).rejects.toThrow("Invalid code");
  });

  test("a rejected code without a banner says so", async () => {
    serve(verifyRoute({ verify: respond("", { location: "/login/tok" }) }));
    await expect(exchangeEmailCode(challenge, "000000")).rejects.toThrow("Code rejected");
  });

  test("missing tokens give a fixed message with no page content", async () => {
    serve(verifyRoute({ clientBody: `<p>nothing here ${XOXD}</p>` }));
    await expect(exchangeEmailCode(challenge, "123456")).rejects.toMatchObject({
      message: "Slack did not return a session. Try again",
    });
  });

  test("a failed auth.test reports only Slack's error code", async () => {
    serve(verifyRoute({ authTest: { error: "invalid_auth", ok: false } }));
    await expect(exchangeEmailCode(challenge, "123456")).rejects.toMatchObject({
      message: "invalid_auth",
    });
  });

  test("falls back to any xoxc token in the page", async () => {
    serve(verifyRoute({ clientBody: `<script>var t = "${XOXC}";</script>` }));
    expect((await exchangeEmailCode(challenge, "123456")).token).toBe(XOXC);
  });
});
