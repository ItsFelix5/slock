// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to mail parsing.
// A deliberately small .eml (RFC 822) reader: enough to show a message's
// From/To/Subject/Date and its plain-text or HTML body. It doesn't walk
// nested multipart trees or pull out attachments — those would need a much
// larger MIME implementation for a feature that's just "preview this email."
export interface ParsedMail {
  bodyHtml?: string;
  bodyText?: string;
  date?: string;
  from?: string;
  subject?: string;
  to?: string;
}

function decodeBody(body: string, partHeaders: string): string {
  if (/content-transfer-encoding:\s*base64/i.test(partHeaders)) {
    try {
      return atob(body.replace(/\s+/g, ""));
    } catch {
      return body;
    }
  }
  if (/content-transfer-encoding:\s*quoted-printable/i.test(partHeaders)) {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
  return body.trim();
}

export function parseEml(raw: string): ParsedMail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const headerEnd = normalized.indexOf("\n\n");
  const headerBlock = headerEnd === -1 ? normalized : normalized.slice(0, headerEnd);
  const rest = headerEnd === -1 ? "" : normalized.slice(headerEnd + 2);

  // Continuation lines (folded headers) start with whitespace — join them
  // back onto the header line they belong to before parsing.
  const unfolded = headerBlock.replace(/\n[ \t]+/g, " ");
  const headers: Record<string, string> = {};
  for (const line of unfolded.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (key in headers) continue;
    headers[key] = line.slice(idx + 1).trim();
  }

  const contentType = (headers["content-type"] ?? "").toLowerCase();
  const boundaryMatch = /boundary="?([^";]+)"?/i.exec(contentType);
  let bodyText: string | undefined;
  let bodyHtml: string | undefined;

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rest.split(`--${boundary}`).slice(1, -1);
    for (const part of parts) {
      const partHeaderEnd = part.indexOf("\n\n");
      if (partHeaderEnd === -1) continue;
      const partHeaders = part.slice(0, partHeaderEnd).toLowerCase();
      const partBody = part.slice(partHeaderEnd + 2);
      if (partHeaders.includes("text/html") && !bodyHtml) {
        bodyHtml = decodeBody(partBody, partHeaders);
      } else if (partHeaders.includes("text/plain") && !bodyText) {
        bodyText = decodeBody(partBody, partHeaders);
      }
    }
  } else {
    const transferEncoding = headers["content-transfer-encoding"] ?? "";
    const decoded = decodeBody(rest, `${contentType}\n${transferEncoding}`);
    if (contentType.includes("text/html")) bodyHtml = decoded;
    else bodyText = decoded;
  }

  return {
    bodyHtml,
    bodyText,
    date: headers.date,
    from: headers.from,
    subject: headers.subject,
    to: headers.to,
  };
}
