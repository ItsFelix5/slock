const TOKEN_BOUNDARY_RE = /[ \uFFFC\n]/;

export function tokenAt(value: string, cursor: number) {
  let start = Math.min(cursor, value.length);
  while (start > 0 && !TOKEN_BOUNDARY_RE.test(value.charAt(start - 1))) start--;
  let end = cursor;
  while (end < value.length && !TOKEN_BOUNDARY_RE.test(value.charAt(end))) end++;
  return { end, start, value: value.slice(start, cursor) };
}

export function partialToken(text: string, cursor: number) {
  const raw = tokenAt(text, cursor).value;
  const negated = raw.startsWith("-");
  const body = negated ? raw.slice(1) : raw;
  const colon = body.indexOf(":");
  if (colon < 0) return;
  const typed = body.slice(colon + 1).toLowerCase();
  return {
    modifier: body.slice(0, colon).toLowerCase(),
    prefix: negated ? "-" : "",
    raw,
    sigil: typed.charAt(0),
    term: typed.replace(/^[#@:]|:$/g, ""),
  };
}
