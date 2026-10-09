import {
  type Block,
  type ContextBlock,
  type HeaderBlock,
  isRichTextSubBlock,
  narrowByType,
  type RichTextBlock,
  type RichTextInlineElement,
  type RichTextStyle,
  type RichTextSubBlock,
} from "@slock/types";
import { INLINE_MARKS } from "@slock/ui/editor/markdownAutoformat";
import type Quill from "quill";
import { Delta } from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { linkMentionValue, stripLeadingAt } from "./quillMentions";

type DeltaOp = { insert: string | Record<string, unknown>; attributes?: Record<string, unknown> };

function styleToFormat(style: RichTextStyle | undefined): Record<string, true> {
  const format: Record<string, true> = {};
  for (const [, key] of INLINE_MARKS) if (style?.[key]) format[key] = true;
  return format;
}

function inlineOps(
  elements: (RichTextInlineElement | RichTextSubBlock)[],
  onUnresolvedUser?: (id: string) => void,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (const el of elements) {
    if (isRichTextSubBlock(el)) continue;
    if (el.type === "text") {
      if (!el.text) continue;
      const attributes = styleToFormat(el.style);
      ops.push(
        Object.keys(attributes).length ? { attributes, insert: el.text } : { insert: el.text },
      );
    } else if (el.type === "user") {
      const user = store.users.userById(el.user_id);
      if (!user) onUnresolvedUser?.(el.user_id);
      ops.push({
        insert: { mention: { id: el.user_id, kind: "user", name: user?.name ?? el.user_id } },
      });
    } else if (el.type === "channel") {
      ops.push({
        insert: {
          mention: {
            id: el.channel_id,
            kind: "channel",
            name: channelDisplayName(store.channels.channelById(el.channel_id), el.channel_id),
          },
        },
      });
    } else if (el.type === "usergroup") {
      ops.push({
        insert: {
          mention: {
            id: el.usergroup_id,
            kind: "usergroup",
            name: stripLeadingAt(
              store.usergroups.usergroupById(el.usergroup_id)?.name ?? el.usergroup_id,
            ),
          },
        },
      });
    } else if (el.type === "emoji") {
      ops.push({ insert: { emoji: { name: el.name } } });
    } else if (el.type === "date") {
      ops.push({
        insert: { date: { fallback: el.fallback ?? "", format: el.format, ts: el.timestamp } },
      });
    } else if (el.type === "broadcast") {
      ops.push(
        el.range === "channel" || el.range === "here"
          ? { insert: { mention: { id: el.range, kind: "special", name: el.range } } }
          : { insert: `@${el.range}` },
      );
    } else if (el.type === "message_mention") {
      const mention = linkMentionValue(el.url, el.url, el.author_id);
      ops.push({ insert: mention ? { mention } : el.url });
    } else if (el.type === "link") {
      const mention = linkMentionValue(el.url, el.text || el.url);
      if (mention) {
        ops.push({ insert: { mention } });
      } else {
        const attributes = { ...styleToFormat(el.style), link: el.url };
        ops.push({ attributes, insert: el.text || el.url });
      }
    } else if ("text" in el && typeof el.text === "string" && el.text) {
      ops.push({ insert: el.text });
    }
  }
  return ops;
}

function pushLine(
  ops: DeltaOp[],
  elements: (RichTextInlineElement | RichTextSubBlock)[],
  blockAttrs?: Record<string, unknown>,
  onUnresolvedUser?: (id: string) => void,
) {
  ops.push(...inlineOps(elements, onUnresolvedUser));
  ops.push(blockAttrs ? { attributes: blockAttrs, insert: "\n" } : { insert: "\n" });
}

export function richTextDeltaOps(
  blocks: readonly Block[],
  onUnresolvedUser?: (id: string) => void,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (const block of blocks) {
    const header = narrowByType<Block, HeaderBlock>(block, "header");
    if (header) {
      ops.push({ insert: header.text.text });
      ops.push({ attributes: { header: header.level ?? 1 }, insert: "\n" });
      continue;
    }
    const context = narrowByType<Block, ContextBlock>(block, "context");
    if (context) {
      const text = context.elements.map((el) => ("text" in el ? el.text : "")).join(" ");
      ops.push({ insert: text });
      ops.push({ attributes: { context: true }, insert: "\n" });
      continue;
    }
    if (block.type === "divider") {
      ops.push({ insert: { divider: true } });
      ops.push({ insert: "\n" });
      continue;
    }
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (!richText) continue;
    for (const sub of richText.elements) {
      if (sub.type === "rich_text_section")
        pushLine(ops, sub.elements, undefined, onUnresolvedUser);
      else if (sub.type === "rich_text_preformatted")
        pushLine(ops, sub.elements, { "code-block": true }, onUnresolvedUser);
      else if (sub.type === "rich_text_quote")
        pushLine(ops, sub.elements, { blockquote: true }, onUnresolvedUser);
      else if (sub.type === "rich_text_list") {
        for (const item of sub.elements)
          pushLine(ops, item.elements, { list: sub.style }, onUnresolvedUser);
      }
    }
  }
  return ops;
}

export function loadRichTextIntoQuill(
  quill: Quill,
  blocks: readonly Block[],
  onUnresolvedUser?: (id: string) => void,
): void {
  const ops = richTextDeltaOps(blocks, onUnresolvedUser);
  quill.setContents(new Delta(ops.length ? ops : [{ insert: "\n" }]));
}

export function insertRichTextAt(
  quill: Quill,
  start: number,
  deleteCount: number,
  blocks: readonly Block[],
  onUnresolvedUser?: (id: string) => void,
): number {
  const ops = richTextDeltaOps(blocks, onUnresolvedUser);
  const insertDelta = new Delta(ops.length ? ops : [{ insert: "\n" }]);
  quill.updateContents(new Delta().retain(start).delete(deleteCount).concat(insertDelta), "user");
  const length = ops.reduce(
    (n, op) => n + (typeof op.insert === "string" ? op.insert.length : 1),
    0,
  );
  const end = start + length;
  quill.setSelection(end, 0);
  return end;
}
