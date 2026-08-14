import type {
  ContextBlock,
  HeaderBlock,
  MarkdownBlock,
  RichTextBlock,
  RichTextInlineElement,
  RichTextStyle,
  RichTextSubBlock,
  SectionBlock,
  Block as SlackBlock,
} from "@slock/slack-api";
import {
  createAtomRun,
  createContext,
  createDivider,
  createHeading,
  createId,
  createLinkRun,
  createList,
  createListItem,
  createParagraph,
  createQuote,
  createTextRun,
  type Block as DocBlock,
  type DocModel,
  emptyDoc,
  type InlineRun,
  type Mark,
} from "@slock/ui";
import { type InlineNode, parseInline } from "../mrkdwnInline";
import { ATOM_DATE, ATOM_EMOJI, ATOM_MENTION } from "./atomTypes";
import { preformattedToDoc } from "./pipeTable";

type Doc = DocModel;
type AnyRun = InlineRun;

function styleToMarks(style: RichTextStyle | undefined): Mark[] {
  if (!style) return [];
  const marks: Mark[] = [];
  if (style.bold) marks.push("bold");
  if (style.italic) marks.push("italic");
  if (style.strike) marks.push("strike");
  if (style.code) marks.push("code");
  return marks;
}

function inlineToRun(el: RichTextInlineElement): AnyRun {
  switch (el.type) {
    case "text":
      return { id: createId(), kind: "text", marks: styleToMarks(el.style), text: el.text };
    case "link":
      return createLinkRun(el.text ?? el.url, el.url, styleToMarks(el.style));
    case "emoji":
      return createAtomRun(ATOM_EMOJI, {
        fallbackText: `:${el.name}:`,
        name: el.name,
        unicode: el.unicode,
      });
    case "user":
      return createAtomRun(ATOM_MENTION, {
        fallbackText: `<@${el.user_id}>`,
        refId: el.user_id,
        target: "user" as const,
      });
    case "channel":
      return createAtomRun(ATOM_MENTION, {
        fallbackText: `<#${el.channel_id}>`,
        refId: el.channel_id,
        target: "channel" as const,
      });
    case "date":
      return createAtomRun(ATOM_DATE, {
        fallback: el.fallback,
        fallbackText: el.fallback ?? "",
        format: el.format,
        timestamp: el.timestamp,
        url: el.url,
      });
    case "usergroup":
      return createTextRun(`@${el.usergroup_id}`);
    case "broadcast":
      return createTextRun(`@${el.range}`);
    case "color":
      return createTextRun(el.value);
    case "message_mention":
      return createTextRun(el.text ?? el.url);
    default:
      return createTextRun("");
  }
}

function inlineElementsToRuns(elements: RichTextInlineElement[]): AnyRun[] {
  const runs = elements.map(inlineToRun);
  return runs.length > 0 ? runs : [createTextRun("")];
}

const CHECK_RE = /^(☐|☑)\s/;

function stripChecklistGlyph(runs: AnyRun[]): { checked: boolean; runs: AnyRun[] } | undefined {
  const [first] = runs;
  if (first?.kind !== "text") return;
  const match = CHECK_RE.exec(first.text);
  if (!match) return;
  const rest = first.text.slice(match[0].length);
  const restRun: AnyRun = { ...first, text: rest };
  return { checked: match[1] === "☑", runs: rest ? [restRun, ...runs.slice(1)] : runs.slice(1) };
}

function richTextListToDoc(sub: Extract<RichTextSubBlock, { type: "rich_text_list" }>): DocBlock {
  const stripped = sub.elements.map((item) =>
    stripChecklistGlyph(inlineElementsToRuns(item.elements)),
  );
  const isChecklist = stripped.every((s) => s !== undefined);
  if (isChecklist) {
    return createList(
      "checkbox",
      stripped.map((s) => createListItem(s?.runs ?? [], s?.checked)),
    );
  }
  return createList(
    sub.style === "ordered" ? "ordered" : "bullet",
    sub.elements.map((item) => createListItem(inlineElementsToRuns(item.elements))),
  );
}

function groupQuoteElements(
  elements: (RichTextInlineElement | RichTextSubBlock)[],
): RichTextSubBlock[] {
  const SUB_TYPES = new Set([
    "rich_text_section",
    "rich_text_list",
    "rich_text_preformatted",
    "rich_text_quote",
  ]);
  const out: RichTextSubBlock[] = [];
  let run: RichTextInlineElement[] = [];
  const flush = () => {
    if (run.length > 0) out.push({ elements: run, type: "rich_text_section" });
    run = [];
  };
  for (const el of elements) {
    if (SUB_TYPES.has(el.type)) {
      flush();
      out.push(el as RichTextSubBlock);
    } else {
      run.push(el as RichTextInlineElement);
    }
  }
  flush();
  return out;
}

function subBlockToDoc(sub: RichTextSubBlock): DocBlock {
  switch (sub.type) {
    case "rich_text_section":
      return createParagraph(inlineElementsToRuns(sub.elements));
    case "rich_text_list":
      return richTextListToDoc(sub);
    case "rich_text_preformatted":
      return preformattedToDoc(sub);
    case "rich_text_quote":
      return createQuote(groupQuoteElements(sub.elements).map(subBlockToDoc));
    default:
      return createParagraph();
  }
}

function flattenInlineNode(node: InlineNode, marks: Mark[]): AnyRun[] {
  switch (node.t) {
    case "text":
      return node.text ? [{ id: createId(), kind: "text", marks, text: node.text }] : [];
    case "bold":
      return node.nodes.flatMap((n) =>
        flattenInlineNode(n, [...new Set([...marks, "bold" as Mark])]),
      );
    case "italic":
      return node.nodes.flatMap((n) =>
        flattenInlineNode(n, [...new Set([...marks, "italic" as Mark])]),
      );
    case "strike":
      return node.nodes.flatMap((n) =>
        flattenInlineNode(n, [...new Set([...marks, "strike" as Mark])]),
      );
    case "code":
      return node.nodes.flatMap((n) =>
        flattenInlineNode(n, [...new Set([...marks, "code" as Mark])]),
      );
    case "emoji":
      return [createAtomRun(ATOM_EMOJI, { fallbackText: `:${node.name}:`, name: node.name })];
    case "link":
      return [createLinkRun(node.label ?? node.url, node.url, marks)];
    case "userlink":
      return [
        createAtomRun(ATOM_MENTION, {
          fallbackText: `<@${node.id}>`,
          refId: node.id,
          target: "user" as const,
        }),
      ];
    case "user":
      return [
        createAtomRun(ATOM_MENTION, {
          fallbackText: `<@${node.id}>`,
          refId: node.id,
          target: "user" as const,
        }),
      ];
    case "channel":
      return [
        createAtomRun(ATOM_MENTION, {
          fallbackText: `<#${node.id}>`,
          refId: node.id,
          target: "channel" as const,
        }),
      ];
    case "usergroup":
      return [createTextRun(node.label ?? `@${node.id}`, marks)];
    case "broadcast":
      return [createTextRun(`@${node.range}`, marks)];
    case "date":
      return [
        createAtomRun(ATOM_DATE, {
          fallback: node.fallback,
          fallbackText: node.fallback ?? "",
          format: node.format,
          timestamp: node.timestamp,
          url: node.url,
        }),
      ];
    default:
      return [];
  }
}

function mrkdwnStringToRuns(text: string): AnyRun[] {
  const runs = parseInline(text).flatMap((n) => flattenInlineNode(n, []));
  return runs.length > 0 ? runs : [createTextRun("")];
}

/** The inverse of `docToBlocks` — used for edit-loading an existing message and for loading a
 * saved draft. Also tolerates blocks this composer didn't author (a `rich_text` from another
 * client, an unrecognized inline element) by degrading to plain text rather than throwing. */
export function blocksToDoc(blocks: SlackBlock[] | undefined): Doc {
  if (!blocks || blocks.length === 0) return emptyDoc();
  const out: DocBlock[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const header = block as HeaderBlock;
        out.push(createHeading(1, [createTextRun(header.text.text)]));
        break;
      }
      case "divider":
        out.push(createDivider());
        break;
      case "context": {
        const context = block as ContextBlock;
        const runs = context.elements.flatMap((el) =>
          el.type === "image" ? [] : mrkdwnStringToRuns(el.text ?? ""),
        );
        out.push(createContext(runs.length > 0 ? runs : [createTextRun("")]));
        break;
      }
      case "rich_text": {
        const richText = block as RichTextBlock;
        out.push(...richText.elements.map(subBlockToDoc));
        break;
      }
      case "markdown": {
        const markdown = block as MarkdownBlock;
        out.push(createParagraph(mrkdwnStringToRuns(markdown.text)));
        break;
      }
      case "section": {
        const section = block as SectionBlock;
        if (section.text) out.push(createParagraph(mrkdwnStringToRuns(section.text.text)));
        break;
      }
      default:
        break;
    }
  }
  return { blocks: out.length > 0 ? out : [createParagraph()] };
}
