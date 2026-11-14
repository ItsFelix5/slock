const EMAIL_PREVIEW_POLICY =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: cid:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">";

export function emailSrcdoc(html: string): string {
  return `${EMAIL_PREVIEW_POLICY}${html}`;
}
