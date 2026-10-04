export type CookieJar = Map<string, string>;

type Page = { body: string; url: string };

function cookieHeader(cookies: CookieJar): string {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(cookies: CookieJar, response: Response): void {
  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const value of setCookies) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const name = pair.slice(0, separator).trim();
    if (name) cookies.set(name, pair.slice(separator + 1).trim());
  }
}

async function request(cookies: CookieJar, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", "slock :D");
  headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  const cookieValue = cookieHeader(cookies);
  if (cookieValue) headers.set("Cookie", cookieValue);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  storeCookies(cookies, response);
  return response;
}

async function followRedirects(
  cookies: CookieJar,
  response: Response,
  startingUrl: string,
): Promise<Page> {
  let currentResponse = response;
  let currentUrl = startingUrl;
  for (let i = 0; i < 20; i++) {
    const location = currentResponse.headers.get("location");
    if (!location) return { body: await currentResponse.text(), url: currentUrl };
    const nextUrl = new URL(location, currentUrl).toString();
    currentResponse = await request(cookies, nextUrl, {
      method: currentResponse.status === 307 || currentResponse.status === 308 ? "POST" : "GET",
    });
    currentUrl = nextUrl;
  }
  throw new Error("Too many redirects");
}

export async function visit(
  cookies: CookieJar,
  url: string,
  headers?: Record<string, string>,
): Promise<Page> {
  return followRedirects(cookies, await request(cookies, url, { headers }), url);
}

export const JS_REDIRECT_RE = /(?:window|document)\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i;

export async function followJsRedirects(cookies: CookieJar, page: Page): Promise<Page> {
  let current = page;
  for (let i = 0; i < 10; i++) {
    const next = current.body.match(JS_REDIRECT_RE)?.[1];
    if (!next) return current;
    current = await visit(cookies, new URL(next, current.url).toString());
  }
  return current;
}

export async function postForm(
  cookies: CookieJar,
  url: string,
  fields: Record<string, string>,
  referer: string,
): Promise<Page> {
  const response = await request(cookies, url, {
    body: new URLSearchParams(fields),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: new URL(referer).origin,
      Referer: referer,
    },
    method: "POST",
  });
  return followRedirects(cookies, response, url);
}
