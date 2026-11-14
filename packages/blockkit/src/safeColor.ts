const HEX_COLOR_RE = /^#?((?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function safeColor(value: string | undefined): string | undefined {
  const hex = value && HEX_COLOR_RE.exec(value.trim())?.[1];
  return hex ? `#${hex}` : undefined;
}

export function safeBase64(value: string | undefined): string | undefined {
  return value && BASE64_RE.test(value) ? value : undefined;
}
