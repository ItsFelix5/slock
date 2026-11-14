import { afterEach, describe, expect, test } from "bun:test";
import type { SlackFile } from "@slock/types";
import { render } from "solid-js/web";
import FileDetailPreview from "../../../../../src/files/client/views/file-detail/FileDetailPreview";

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

const mountPreview = (fields: Partial<SlackFile>) => {
  const host = document.createElement("div");
  document.body.append(host);
  const file = { id: "F1", name: "a", ...fields } as SlackFile;
  disposers.push(
    render(() => <FileDetailPreview content={undefined} failed={false} file={file} />, host),
  );
  return host;
};

describe("FileDetailPreview", () => {
  test("renders a safe image thumbnail", () => {
    const host = mountPreview({ isImage: true, thumbUrl: "https://files.slack.com/t.png" });
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://files.slack.com/t.png");
  });

  test.each([
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//evil.com/t.png",
  ])("drops image thumbnail %p", (thumbUrl) => {
    const host = mountPreview({ isImage: true, thumbUrl });
    expect(host.querySelector("img")).toBeNull();
  });

  test("links a safe original", () => {
    const host = mountPreview({ urlPrivate: "https://files.slack.com/f.zip" });
    expect(host.querySelector("a")?.getAttribute("href")).toBe("https://files.slack.com/f.zip");
  });

  test.each(["javascript:alert(1)", "//evil.com/f.zip"])("hides open link for %p", (urlPrivate) => {
    const host = mountPreview({ urlPrivate });
    expect(host.querySelector("a")).toBeNull();
  });
});
