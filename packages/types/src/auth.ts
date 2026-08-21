const SLACK_SESSION_INVALID_CHARS = /[;\s]/;

export function extractSlackSession(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    if (value.startsWith("xoxd-") && !SLACK_SESSION_INVALID_CHARS.test(value)) return value;
  }
}
