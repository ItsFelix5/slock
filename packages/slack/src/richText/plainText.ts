import { logUnknown } from "@slock/core";
import type { RichTextBlock, RichTextInlineElement, RichTextSubBlock } from "@slock/types";
import { messageMentionUrl } from "./messageMention";

export function isRichTextSubBlock(
  el: RichTextInlineElement | RichTextSubBlock,
): el is RichTextSubBlock {
  return el.type.startsWith("rich_text_");
}

function richTextInlineToPlainText(el: RichTextInlineElement, domain: string | null): string {
  switch (el.type) {
    case "text":
      return el.text;
    case "link":
      return el.text || el.url;
    case "emoji":
      return `:${el.name}:`;
    case "user":
    case "canvas_user_mention":
      return `<@${el.user_id}>`;
    case "channel":
      return `<#${el.channel_id}>`;
    case "usergroup":
      return `<!subteam^${el.usergroup_id}>`;
    case "broadcast":
      return `@${el.range}`;
    case "message_mention":
      return el.text ?? messageMentionUrl(el, domain);
    case "date":
      return el.fallback ?? "";
    case "canvas":
      return el.text || "canvas";
    case "canvas_message_unfurl":
      return messageMentionUrl(
        {
          channel_id: el.root_message_channel,
          message_ts: el.root_message_ts,
          type: "message_mention",
        },
        domain,
      );
    case "attachment_mention":
      return el.text || el.url;
    case "citation":
    case "work_object_mention":
    case "workflow_mention":
      return el.text;
    case "file":
    case "list_record":
      return el.text || el.url || "";
    case "salesforce_data_field":
      return el.salesforce_field_label || "";
    case "tag":
      return el.text;
    case "color":
    case "team":
      return "";
    default:
      logUnknown("rich text element", el satisfies never);
      return "";
  }
}

function richTextSubBlockToPlainText(sub: RichTextSubBlock, domain: string | null): string {
  const inline = (el: RichTextInlineElement) => richTextInlineToPlainText(el, domain);
  switch (sub.type) {
    case "rich_text_header":
    case "rich_text_section":
    case "rich_text_preformatted":
      return sub.elements.map(inline).join("");
    case "rich_text_divider":
      return "";
    case "rich_text_list":
      return sub.elements.map((item) => item.elements.map(inline).join("")).join(" ");
    case "rich_text_quote":
      return sub.elements
        .map((el) =>
          isRichTextSubBlock(el) ? richTextSubBlockToPlainText(el, domain) : inline(el),
        )
        .join("");
    default:
      logUnknown("rich text block", sub satisfies never);
      return "";
  }
}

export function richTextBlocksToPlainText(
  blocks: readonly RichTextBlock[],
  domain: string | null,
): string {
  return blocks
    .map((block) =>
      block.elements.map((sub) => richTextSubBlockToPlainText(sub, domain)).join("\n"),
    )
    .join("\n")
    .trim();
}
