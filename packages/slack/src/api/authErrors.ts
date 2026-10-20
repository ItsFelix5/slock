const AUTH_ERRORS = new Set([
  "not_configured",
  "invalid_auth",
  "not_authed",
  "token_revoked",
  "account_inactive",
]);

export function isAuthError(code: unknown): boolean {
  return typeof code === "string" && AUTH_ERRORS.has(code);
}
