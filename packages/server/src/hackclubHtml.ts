const CSRF_META_RE = /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i;

const CLASS_ATTR_RE = /class=["']([^"']*)["']/i;

const WHITESPACE_RE = /\s+/;

export const FORM_ACTION_RE = /<form[^>]*action=["']([^"']+)["']/i;

const NAME_ATTR_RE = /\bname=["']([^"']+)["']/i;

const VALUE_ATTR_RE = /\bvalue=["']([^"']*)["']/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractInput(html: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<input[^>]*name=["']${escapedName}["'][^>]*value=["']([^"']*)["']`, "i"),
    new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${escapedName}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}

export function extractCsrfToken(html: string): string {
  const meta = html.match(CSRF_META_RE);
  if (meta?.[1]) return decodeHtml(meta[1]);
  const input = extractInput(html, "authenticity_token");
  if (input) return input;
  throw new Error("Could not find the Hack Club Auth CSRF token");
}

function elementText(html: string): string | null {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) =>
      item[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (items.length) return items.join("; ");
  return (
    html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function matchingDivClose(html: string, from: number): number {
  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  tagRe.lastIndex = from;
  let depth = 1;
  for (let match = tagRe.exec(html); match; match = tagRe.exec(html)) {
    depth += match[0][1] === "/" ? -1 : 1;
    if (depth === 0) return match.index;
  }
  return html.length;
}

function extractBanner(html: string, variant: "danger" | "warning"): string | null {
  const openRe = /<div\b([^>]*)>/gi;
  for (let open = openRe.exec(html); open; open = openRe.exec(html)) {
    const classes = (open[1].match(CLASS_ATTR_RE)?.[1] ?? "").split(WHITESPACE_RE);
    if (!(classes.includes("banner") && classes.includes(variant))) continue;
    return elementText(html.slice(openRe.lastIndex, matchingDivClose(html, openRe.lastIndex)));
  }
  return null;
}

export function extractFlashError(html: string): string | null {
  return extractBanner(html, "danger") ?? extractBanner(html, "warning");
}

export function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function formAction(html: string, baseUrl: string): string {
  const match = html.match(FORM_ACTION_RE);
  return new URL(match?.[1] ?? baseUrl, baseUrl).toString();
}

export function extractFormFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    const name = attributes.match(NAME_ATTR_RE)?.[1];
    if (!name) continue;
    fields[name] = decodeHtml(attributes.match(VALUE_ATTR_RE)?.[1] ?? "");
  }
  return fields;
}
