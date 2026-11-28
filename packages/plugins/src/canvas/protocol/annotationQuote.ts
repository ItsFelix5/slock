import { encodeTextEntities, richTextBlocksToPlainText } from "@slock/slack";
import type { CanvasNode, RichTextInlineElement } from "@slock/types";
import type { CanvasEmbed } from "./embeds.ts";
import { htmlTokens } from "./htmlTokens.ts";

interface AnnotationQuote {
  elements: RichTextInlineElement[];
  sectionId: string;
}

export function htmlLines(nodes: CanvasNode[]): { html: string; id: string }[] {
  return nodes.flatMap((node) => {
    if (node.kind === "table")
      return node.rows.flatMap((row) =>
        row.cells.map((cell) => ({ html: cell.html, id: cell.contentId })),
      );
    return "html" in node ? [{ html: node.html, id: node.id }] : [];
  });
}

export function isThreadAnnotation(annotationId: string, threadId: string): boolean {
  return annotationId.includes(threadId);
}

function embedElement(embed: CanvasEmbed | undefined): RichTextInlineElement[] {
  if (embed?.type === "user") return [{ type: "user", user_id: embed.userId }];
  if (embed?.type === "channel") return [{ channel_id: embed.channelId, type: "channel" }];
  if (embed?.type === "emoji") return [{ name: embed.shortcode, type: "emoji" }];
  if (embed?.type === "link") return [{ text: embed.title, type: "text" }];
  if (embed?.type !== "date") return [];
  return [
    {
      fallback: new Date(embed.ms).toISOString().slice(0, 10),
      format: "{date_short}",
      timestamp: Math.floor(embed.ms / 1000),
      type: "date",
    },
  ];
}

function annotatedElements(
  html: string,
  embeds: ReadonlyMap<string, CanvasEmbed>,
  threadId: string,
): RichTextInlineElement[] {
  const open: boolean[] = [];
  return htmlTokens(html).flatMap((token): RichTextInlineElement[] => {
    const inside = open.includes(true);
    if ("text" in token) return inside ? [{ text: token.text, type: "text" }] : [];
    const { closing, name, target } = token.tag;
    if (name === "annotation") {
      if (closing) open.pop();
      else open.push(isThreadAnnotation(target, threadId));
    }
    return inside && name === "control" && !closing ? embedElement(embeds.get(target)) : [];
  });
}

export function annotationQuote(
  nodes: CanvasNode[],
  embeds: ReadonlyMap<string, CanvasEmbed>,
  threadId: string,
): AnnotationQuote | null {
  const found = htmlLines(nodes).flatMap(({ html, id }) => {
    const elements = annotatedElements(html, embeds, threadId);
    return elements.length > 0 ? [{ elements, id }] : [];
  });
  const [first] = found;
  if (!first) return null;
  const elements = found.flatMap((line, index): RichTextInlineElement[] =>
    index === 0 ? line.elements : [{ text: "\n", type: "text" }, ...line.elements],
  );
  return { elements, sectionId: first.id };
}

export function quoteMrkdwn({ elements }: AnnotationQuote, domain: string | null): string {
  const escaped = elements.map((element) =>
    element.type === "text" ? { ...element, text: encodeTextEntities(element.text) } : element,
  );
  return richTextBlocksToPlainText(
    [{ elements: [{ elements: escaped, type: "rich_text_section" }], type: "rich_text" }],
    domain,
  );
}
