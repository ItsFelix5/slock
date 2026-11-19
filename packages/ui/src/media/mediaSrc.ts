const SLACK_HOST_RE = /\.(?:slack-files|slack|slack-edge)\.com$/;
const HTTP_RE = /^https?:\/\//i;

function isSlackFile(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && SLACK_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function fileSrc(url: string): string;
export function fileSrc(url: string | undefined): string | undefined;
export function fileSrc(url: string | undefined): string | undefined {
  return url && isSlackFile(url) ? `/api/assets?url=${encodeURIComponent(url)}` : url;
}

export function imageSrc(url: string): string;
export function imageSrc(url: string | undefined): string | undefined;
export function imageSrc(url: string | undefined): string | undefined {
  if (!url) return url;
  if (isSlackFile(url)) return fileSrc(url);
  return HTTP_RE.test(url)
    ? `https://slack-imgs.com/?c=1&o1=ro&url=${encodeURIComponent(url)}`
    : url;
}
