import type { Credentials } from "./auth.ts";
import {
  extractCsrfToken,
  extractFlashError,
  extractFormFields,
  extractVisibleText,
  FORM_ACTION_RE,
  formAction,
} from "./hackclubHtml.ts";
import {
  type CookieJar,
  followJsRedirects,
  JS_REDIRECT_RE,
  postForm,
  visit,
} from "./hackclubHttp.ts";
import { callSlack } from "./slackClient.ts";

export type EmailChallenge = {
  cookies: [string, string][];
  csrfToken: string;
  pageUrl: string;
  verificationUrl: string;
};

const WEBAUTHN_PATH_RE = /^\/login\/[^/]+\/webauthn$/;

const EMAIL_STEP_PATH_RE = /^\/login\/[^/]+(?:\/verify)?$/;

const TRAILING_SLASH_RE = /\/$/;

const BOOT_TOKEN_RE = /"E09V59WQY1E"\s*:\s*\{[^{}]*"token"\s*:\s*"(xoxc-[^"]+)"/;

const API_TOKEN_RE = /"api_token"\s*:\s*"(xoxc-[^"]+)"/;

const XOXC_RE = /xoxc-[A-Za-z0-9-]+/;

export async function requestEmailCode(email: string): Promise<EmailChallenge> {
  if (!email.includes("@")) throw new Error("Invalid email address");

  const cookies: CookieJar = new Map();
  const loginUrl = "https://auth.hackclub.com/login";
  const login = await visit(cookies, loginUrl);
  const csrf = extractCsrfToken(login.body);

  let page = await postForm(
    cookies,
    loginUrl,
    {
      authenticity_token: csrf,
      commit: "Continue →",
      email,
      fingerprint: crypto.randomUUID().replaceAll("-", ""),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    loginUrl,
  );

  if (new URL(page.url).pathname.startsWith("/signup"))
    throw new Error(`No Hack Club Auth account exists for ${email}`);

  const flash = extractFlashError(page.body);
  if (flash) throw new Error(flash);

  if (WEBAUTHN_PATH_RE.test(new URL(page.url).pathname))
    page = await postForm(
      cookies,
      `${page.url}/skip`,
      { authenticity_token: extractCsrfToken(page.body) },
      page.url,
    );

  if (!EMAIL_STEP_PATH_RE.test(new URL(page.url).pathname))
    throw new Error(
      `Couldn't reach the email code step for this account (ended up at ${page.url}): ${extractVisibleText(page.body)}`,
    );

  return {
    cookies: [...cookies],
    csrfToken: extractCsrfToken(page.body),
    pageUrl: page.url,
    verificationUrl: page.url.endsWith("/verify")
      ? page.url
      : `${page.url.replace(TRAILING_SLASH_RE, "")}/verify`,
  };
}

export async function exchangeEmailCode(
  challenge: EmailChallenge,
  code: string,
): Promise<Credentials> {
  const cookies: CookieJar = new Map(challenge.cookies);
  let page = await postForm(
    cookies,
    challenge.verificationUrl,
    { authenticity_token: challenge.csrfToken, code, commit: "Verify →" },
    challenge.pageUrl,
  );
  page = await followJsRedirects(cookies, page);

  const flash = extractFlashError(page.body);
  if (flash) throw new Error(flash);

  const { pathname } = new URL(page.url);
  if (pathname !== "/" && pathname !== "")
    throw new Error(
      `Email code was not accepted; authentication ended at ${page.url}: ${extractVisibleText(page.body)}`,
    );

  const home = await visit(cookies, "https://auth.hackclub.com/");
  const csrf = extractCsrfToken(home.body);

  page = await postForm(
    cookies,
    "https://auth.hackclub.com/saml/idp_initiated/slack",
    { authenticity_token: csrf },
    home.url,
  );

  for (let i = 0; i < 12; i++) {
    if (FORM_ACTION_RE.test(page.body)) {
      page = await postForm(
        cookies,
        formAction(page.body, page.url),
        extractFormFields(page.body),
        page.url,
      );
      continue;
    }
    const redirect = page.body.match(JS_REDIRECT_RE)?.[1];
    if (!redirect) break;
    page = await visit(cookies, new URL(redirect, page.url).toString());
  }

  const client = await visit(
    cookies,
    "https://app.slack.com/auth?app=client&return_to=%2Fclient%2FT0266FRGM",
  );
  const xoxc =
    client.body.match(BOOT_TOKEN_RE)?.[1] ??
    client.body.match(API_TOKEN_RE)?.[1] ??
    client.body.match(XOXC_RE)?.[0];
  const xoxd = cookies.get("d");

  if (!(xoxd && xoxc))
    throw new Error(
      `Slack authentication completed without finding tokens (ended up at ${client.url}, ` +
        `xoxc ${xoxc ? "found" : "missing"}, xoxd ${xoxd ? "found" : "missing"}): ${extractVisibleText(client.body)}`,
    );

  const authTest = await callSlack(
    "auth.test",
    {},
    {
      domain: "hackclub.enterprise.slack.com",
      route: "",
      slackSession: xoxd,
      token: xoxc,
    },
  );
  if (!authTest.ok) throw new Error(authTest.error ?? "Slack auth.test failed after SAML login");

  return {
    domain: "hackclub.enterprise.slack.com",
    route: "E09V59WQY1E:E09V59WQY1E",
    slackSession: xoxd,
    token: xoxc,
  };
}
