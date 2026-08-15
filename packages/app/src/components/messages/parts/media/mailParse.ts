export interface ParsedMail {
  bodyHtml?: string;
  bodyText?: string;
  date?: string;
  from?: string;
  subject?: string;
  to?: string;
}

interface MimePart {
  body: string;
  headers: Record<string, string>;
}

const FOLDED_HEADER_RE = /\n[ \t]+/g;
const NON_WHITESPACE_STRIP_RE = /\s+/g;
const SOFT_LINE_BREAK_RE = /=\n/g;
const QUOTED_PRINTABLE_HEX_RE = /^[\dA-Fa-f]{2}$/;
const CHARSET_RE = /charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i;
const ENCODED_WORD_RE = /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi;
const UNDERSCORE_RE = /_/g;
const BOUNDARY_RE = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i;
const ATTACHMENT_DISPOSITION_RE = /attachment/i;
const LEADING_NEWLINE_RE = /^\n/;
const TRAILING_NEWLINE_RE = /\n$/;
const CRLF_RE = /\r\n/g;

function splitPart(raw: string): MimePart {
  const headerEnd = raw.indexOf("\n\n");
  const headerBlock = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  const body = headerEnd === -1 ? "" : raw.slice(headerEnd + 2);
  const headers: Record<string, string> = {};
  for (const line of headerBlock.replace(FOLDED_HEADER_RE, " ").split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (!(key in headers)) headers[key] = line.slice(separator + 1).trim();
  }
  return { body, headers };
}

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(NON_WHITESPACE_STRIP_RE, "")), (character) =>
    character.charCodeAt(0),
  );
}

function bytesFromQuotedPrintable(value: string): Uint8Array {
  const unfolded = value.replace(SOFT_LINE_BREAK_RE, "");
  const bytes: number[] = [];
  for (let index = 0; index < unfolded.length; index += 1) {
    const hex = unfolded.slice(index + 1, index + 3);
    if (unfolded[index] === "=" && QUOTED_PRINTABLE_HEX_RE.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(unfolded.charCodeAt(index));
    }
  }
  return Uint8Array.from(bytes);
}

function decodeBytes(bytes: Uint8Array, charset = "utf-8"): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function decodeBody(body: string, headers: Record<string, string>): string {
  const contentType = headers["content-type"] ?? "";
  const charset = CHARSET_RE.exec(contentType);
  const encoding = headers["content-transfer-encoding"]?.toLowerCase();
  try {
    if (encoding === "base64")
      return decodeBytes(bytesFromBase64(body), charset?.[1] ?? charset?.[2]);
    if (encoding === "quoted-printable")
      return decodeBytes(bytesFromQuotedPrintable(body), charset?.[1] ?? charset?.[2]);
  } catch {}
  return body.trim();
}

function decodeHeader(value: string | undefined): string | undefined {
  if (!value) return;
  return value.replace(
    ENCODED_WORD_RE,
    (_match, charset: string, encoding: string, encoded: string) => {
      try {
        const bytes =
          encoding.toLowerCase() === "b"
            ? bytesFromBase64(encoded)
            : bytesFromQuotedPrintable(encoded.replace(UNDERSCORE_RE, " "));
        return decodeBytes(bytes, charset);
      } catch {
        return encoded;
      }
    },
  );
}

function boundaryFrom(contentType: string): string | undefined {
  const match = BOUNDARY_RE.exec(contentType);
  return match?.[1] ?? match?.[2];
}

function collectBodies(part: MimePart, parsed: ParsedMail, depth = 0) {
  if (depth > 8 || ATTACHMENT_DISPOSITION_RE.test(part.headers["content-disposition"] ?? ""))
    return;
  const contentType = part.headers["content-type"] ?? "text/plain";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  const boundary = boundaryFrom(contentType);
  if (mediaType.startsWith("multipart/") && boundary) {
    const chunks = part.body.split(`--${boundary}`).slice(1);
    for (const chunk of chunks) {
      if (chunk.startsWith("--")) break;
      collectBodies(
        splitPart(chunk.replace(LEADING_NEWLINE_RE, "").replace(TRAILING_NEWLINE_RE, "")),
        parsed,
        depth + 1,
      );
    }
    return;
  }

  if (mediaType === "text/html" && !parsed.bodyHtml)
    parsed.bodyHtml = decodeBody(part.body, part.headers);
  else if (mediaType === "text/plain" && !parsed.bodyText)
    parsed.bodyText = decodeBody(part.body, part.headers);
}

export function parseEml(raw: string): ParsedMail {
  const normalized = raw.replace(CRLF_RE, "\n");
  const root = splitPart(normalized);
  const parsed: ParsedMail = {
    date: decodeHeader(root.headers.date),
    from: decodeHeader(root.headers.from),
    subject: decodeHeader(root.headers.subject),
    to: decodeHeader(root.headers.to),
  };
  collectBodies(root, parsed);
  return parsed;
}
