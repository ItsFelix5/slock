import { describe, expect, test } from "bun:test";
import { emailSrcdoc } from "../../../../src/message-media/client/api/emailSrcdoc";

describe("emailSrcdoc", () => {
  test.each([
    "<html><head><title>x</title></head><body>hi</body></html>",
    "<!-- <head> --><script>alert(1)</script>",
    "<p>no head</p>",
    "",
  ])("starts with the policy before %p", (html) => {
    const doc = emailSrcdoc(html);
    expect(doc).toContain("Content-Security-Policy");
    expect(doc.endsWith(html)).toBe(true);
    expect(doc.startsWith("<meta")).toBe(true);
  });

  test("blocks scripts, remote loads and forms", () => {
    const doc = emailSrcdoc("");
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("img-src data: cid:");
    expect(doc).toContain("form-action 'none'");
  });
});
