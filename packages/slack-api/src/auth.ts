// Shared authentication utilities used by both client and server.

const SLACK_SESSION_INVALID_CHARS = /[;\s]/;

// Extract the Slack session cookie value (the `d=` cookie) from a cookie header string.
// Scans all cookie parts and returns the first valid session found.
// A valid session starts with "xoxd-" and contains no invalid characters.
export function extractSlackSession(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    if (value.startsWith("xoxd-") && !SLACK_SESSION_INVALID_CHARS.test(value)) return value;
  }
}
