import { expect, test } from "bun:test";
import { parseCanvasLink } from "../../../../packages/plugins/src/canvas/client/lib/canvasLinks";

test.each([
  "https://acme.slack.com/docs/T1/F123",
  "https://app.slack.com/client/E1/docs/T1/F123?focus_section_id=temp%3AC%3Aabc",
  "https://app.slack.com/client/E1/unified-files/doc/F123",
])("%s opens the canvas", (link) => {
  expect<string | undefined>(parseCanvasLink(link)).toBe("F123");
});

test.each([
  "https://acme.slack.com/archives/C1/p1",
  "https://slack.com.evil.test/docs/T1/F123",
  "http://acme.slack.com/docs/T1/F123",
])("%s stays an ordinary link", (link) => {
  expect(parseCanvasLink(link)).toBeUndefined();
});
