import type {
  Block,
  BroadcastRange,
  HeaderBlock,
  RichTextInlineElement,
  RichTextStyle,
  RichTextSubBlock,
} from "@slock/types";

export const BLOCKS_CLIPBOARD_TYPE = "application/x-slock-blocks";

const STYLE_SELECTORS: [keyof RichTextStyle, string][] = [
  ["bold", "b, strong, .bk-rt-bold"],
  ["italic", "i, em, .bk-rt-italic"],
  ["strike", "s, del, strike, .bk-rt-strike"],
  ["code", "code, .bk-inline-code"],
];

const SKIPPED_SELECTOR = "button, svg, script, style, img:not([data-emoji-name])";
const SECTION_TAGS = ["DIV", "P"];
const BROADCAST_RANGES: readonly string[] = ["here", "channel", "everyone"];
const HEADER_LEVELS: readonly HeaderBlock["level"][] = [1, 2, 3, 4];

function cleanText(text: string): string {
  return text.replaceAll("​", "").replaceAll(" ", " ");
}

function styleOrUndefined(style: RichTextStyle): RichTextStyle | undefined {
  return Object.keys(style).length ? style : undefined;
}

function withStyle(el: HTMLElement, parent: RichTextStyle): RichTextStyle {
  const style = { ...parent };
  for (const [key, selector] of STYLE_SELECTORS) if (el.matches(selector)) style[key] = true;
  return style;
}

function isBroadcastRange(value: string): value is BroadcastRange {
  return BROADCAST_RANGES.includes(value);
}

function tokenElement(el: HTMLElement, style: RichTextStyle): RichTextInlineElement | undefined {
  const { dataset } = el;
  if (dataset.mentionId) {
    return { style: styleOrUndefined(style), type: "user", user_id: dataset.mentionId };
  }
  if (dataset.channelId) {
    return { channel_id: dataset.channelId, style: styleOrUndefined(style), type: "channel" };
  }
  if (dataset.usergroupId) return { type: "usergroup", usergroup_id: dataset.usergroupId };
  if (dataset.broadcast && isBroadcastRange(dataset.broadcast)) {
    return { range: dataset.broadcast, type: "broadcast" };
  }
  if (dataset.dateTs) {
    return {
      fallback: dataset.dateFallback || undefined,
      format: dataset.dateFormat ?? "",
      timestamp: Number(dataset.dateTs),
      type: "date",
    };
  }
  if (dataset.emojiName) return { name: dataset.emojiName, type: "emoji" };
  if (dataset.linkUrl) {
    return {
      style: styleOrUndefined(style),
      text: cleanText(el.textContent ?? ""),
      type: "link",
      url: dataset.linkUrl,
    };
  }
}

function collectInline(
  node: Node,
  style: RichTextStyle,
  out: RichTextInlineElement[],
): RichTextInlineElement[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = cleanText(node.textContent ?? "");
    if (text) out.push({ style: styleOrUndefined(style), text, type: "text" });
    return out;
  }
  if (!(node instanceof HTMLElement)) return out;
  const token = tokenElement(node, style);
  if (token) {
    out.push(token);
    return out;
  }
  if (node.matches(SKIPPED_SELECTOR)) return out;
  const next = withStyle(node, style);
  for (const child of node.childNodes) collectInline(child, next, out);
  return out;
}

function plainTextWithEmoji(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return cleanText(node.textContent ?? "");
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.emojiName) return `:${node.dataset.emojiName}:`;
  if (node.matches(SKIPPED_SELECTOR)) return "";
  return Array.from(node.childNodes, plainTextWithEmoji).join("");
}

function headerLevel(el: HTMLElement): HeaderBlock["level"] {
  return HEADER_LEVELS[Number(el.tagName[1]) - 1] ?? 4;
}

export function fragmentToBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = [];
  let subBlocks: RichTextSubBlock[] = [];
  let run: RichTextInlineElement[] = [];

  const flushRun = () => {
    if (run.length) subBlocks.push({ elements: run, type: "rich_text_section" });
    run = [];
  };
  const flushRichText = () => {
    flushRun();
    if (subBlocks.length) blocks.push({ elements: subBlocks, type: "rich_text" });
    subBlocks = [];
  };
  const pushSubBlock = (sub: RichTextSubBlock) => {
    flushRun();
    subBlocks.push(sub);
  };
  const pushBlock = (block: Block) => {
    flushRichText();
    blocks.push(block);
  };

  const walk = (parent: Node, style: RichTextStyle) => {
    for (const child of parent.childNodes) {
      if (!(child instanceof HTMLElement)) {
        collectInline(child, style, run);
      } else if (child.matches("hr")) {
        pushBlock({ type: "divider" });
      } else if (child.matches(".bk-header")) {
        const text = plainTextWithEmoji(child);
        if (text) {
          pushBlock({
            level: headerLevel(child),
            text: { emoji: true, text, type: "plain_text" },
            type: "header",
          });
        }
      } else if (child.matches(".bk-context")) {
        const text = plainTextWithEmoji(child);
        if (text) pushBlock({ elements: [{ text, type: "plain_text" }], type: "context" });
      } else if (child.matches("blockquote")) {
        const elements = collectInline(child, {}, []);
        if (elements.length) pushSubBlock({ elements, type: "rich_text_quote" });
      } else if (child.matches("pre")) {
        const elements = collectInline(child, {}, []);
        if (elements.length) pushSubBlock({ elements, type: "rich_text_preformatted" });
      } else if (child.matches("ul, ol")) {
        const items = Array.from(child.children, (li) => collectInline(li, {}, []));
        pushSubBlock({
          elements: items.map((elements) => ({ elements, type: "rich_text_section" })),
          style: child.matches("ol") ? "ordered" : "bullet",
          type: "rich_text_list",
        });
      } else if (tokenElement(child, style) || child.matches(SKIPPED_SELECTOR)) {
        collectInline(child, style, run);
      } else if (SECTION_TAGS.includes(child.tagName)) {
        flushRun();
        walk(child, withStyle(child, style));
        flushRun();
      } else {
        walk(child, withStyle(child, style));
      }
    }
  };

  walk(root, {});
  flushRichText();
  return blocks;
}
