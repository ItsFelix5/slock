import { fileSrc } from "@slock/ui";

const SAFE_SCHEME_RE = /^(?:https?|mailto|tel|slack):/i;

export const HTTP_URL_RE = /^https?:\/\//i;

export function safeUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  return trimmed && SAFE_SCHEME_RE.test(trimmed) ? trimmed : undefined;
}

const ASSET_PROXY_RE = /^\/api\/assets\?/;

export function safeMediaUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  return trimmed && (HTTP_URL_RE.test(trimmed) || ASSET_PROXY_RE.test(trimmed))
    ? fileSrc(trimmed)
    : undefined;
}

export function safeEmbedUrl(
  url: string | undefined,
  appOrigin = window.location.origin,
): string | undefined {
  const trimmed = url?.trim();
  if (!(trimmed && HTTP_URL_RE.test(trimmed) && URL.canParse(trimmed))) return;
  return new URL(trimmed).origin === appOrigin ? undefined : trimmed;
}
