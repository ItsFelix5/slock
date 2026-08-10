import { HEADING_TAG_RE, MRKDWN_DIALECT, serializeNode } from "@slock/blockkit";
import type { Block } from "@slock/slack-api";

export function fragmentToBlocks(root: HTMLElement): Block[] | null {
  if (
    !root.querySelector(
      ":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > hr",
    )
  )
    return null;
  const blocks: Block[] = [];
  let run = "";
  const flush = () => {
    const text = run.trim();
    if (text) blocks.push({ text: { text, type: "mrkdwn" }, type: "section" });
    run = "";
  };
  for (const child of Array.from(root.childNodes)) {
    if (HEADING_TAG_RE.test(child.nodeName)) {
      flush();
      const text = (child.textContent ?? "").trim();
      if (text) blocks.push({ text: { emoji: true, text, type: "plain_text" }, type: "header" });
    } else if (child.nodeName === "HR") {
      flush();
      blocks.push({ type: "divider" });
    } else {
      run += serializeNode(child, MRKDWN_DIALECT);
    }
  }
  flush();
  return blocks;
}
