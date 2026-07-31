// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { parseEml } from "./mailParse";

describe("parseEml", () => {
  test("preserves case-sensitive multipart boundaries", () => {
    const mail = parseEml(
      [
        "Subject: Boundary test",
        'Content-Type: multipart/alternative; boundary="MixedCase_123"',
        "",
        "--MixedCase_123",
        'Content-Type: text/plain; charset="utf-8"',
        "",
        "Readable body",
        "--MixedCase_123--",
      ].join("\r\n"),
    );

    expect(mail.bodyText).toBe("Readable body");
  });

  test("decodes UTF-8 transfer encodings and encoded headers", () => {
    const mail = parseEml(
      [
        "Subject: =?UTF-8?B?Q2Fmw6kg4piV?=",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        "SGVsbG8sIPCfjI0h",
      ].join("\n"),
    );

    expect(mail.subject).toBe("Café ☕");
    expect(mail.bodyText).toBe("Hello, 🌍!");
  });

  test("finds bodies inside nested multiparts and skips attachments", () => {
    const mail = parseEml(
      [
        "Content-Type: multipart/mixed; boundary=outer",
        "",
        "--outer",
        "Content-Type: multipart/alternative; boundary=inner",
        "",
        "--inner",
        "Content-Type: text/plain",
        "Content-Disposition: attachment",
        "",
        "Not the body",
        "--inner",
        "Content-Type: text/html",
        "",
        "<p>Actual body</p>",
        "--inner--",
        "--outer--",
      ].join("\n"),
    );

    expect(mail.bodyText).toBeUndefined();
    expect(mail.bodyHtml).toBe("<p>Actual body</p>");
  });
});
