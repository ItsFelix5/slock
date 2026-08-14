import type {
  RichTextBlock,
  RichTextInlineElement,
  RichTextStyle,
  RichTextSubBlock,
  Block as SlackBlock,
} from "@slock/slack-api";
import type {
  Block as DocBlock,
  ListItem as DocListItem,
  DocModel,
  InlineRun,
  Mark,
} from "@slock/ui";
import {
  ATOM_EMOJI,
  ATOM_MENTION,
  type ComposeAtomData,
  type DateAtomData,
  type EmojiAtomData,
  type MentionAtomData,
} from "./atomTypes";

type Doc = DocModel<ComposeAtomData>;
type AnyRun = InlineRun<ComposeAtomData>;

function marksToStyle(marks: Mark[]): RichTextStyle | undefined {
  if (marks.length === 0) return;
  const style: RichTextStyle = {};
  if (marks.includes("bold")) style.bold = true;
  if (marks.includes("italic")) style.italic = true;
  if (marks.includes("strike")) style.strike = true;
  if (marks.includes("code")) style.code = true;
  return style;
}

function runToInline(run: AnyRun): RichTextInlineElement {
  if (run.kind === "text") return { style: marksToStyle(run.marks), text: run.text, type: "text" };
  if (run.kind === "link") {
    return { style: marksToStyle(run.marks), text: run.text, type: "link", url: run.url };
  }
  const data = run.data as ComposeAtomData;
  if (run.atomType === ATOM_MENTION) {
    const m = data as MentionAtomData;
    return m.target === "user"
      ? { type: "user", user_id: m.refId }
      : { channel_id: m.refId, type: "channel" };
  }
  if (run.atomType === ATOM_EMOJI) {
    const e = data as EmojiAtomData;
    return { name: e.name, type: "emoji", unicode: e.unicode };
  }
  const d = data as DateAtomData;
  return {
    fallback: d.fallback,
    format: d.format,
    timestamp: d.timestamp,
    type: "date",
    url: d.url,
  };
}

function runsToInline(runs: AnyRun[]): RichTextInlineElement[] {
  return runs.map(runToInline);
}

/** Header/context text objects can't carry marks or atoms (real Slack `TextObject`s there are
 * `plain_text`, or route through the flat mrkdwn string parser) — flatten to plain text using
 * each run's fallback, dropping formatting rather than inventing wire syntax for it. */
function runsToPlainText(runs: AnyRun[]): string {
  return runs
    .map((r) => {
      if (r.kind === "text" || r.kind === "link") return r.text;
      const data = r.data as ComposeAtomData;
      return data.fallbackText;
    })
    .join("");
}

function checklistPrefix(item: DocListItem<ComposeAtomData>): AnyRun[] {
  const glyph = item.checked ? "☑ " : "☐ ";
  return [{ id: `${item.id}-glyph`, kind: "text", marks: [], text: glyph }, ...item.runs];
}

function tableToPipeText(rows: { cells: { runs: AnyRun[] }[] }[]): string {
  const lines = rows.map(
    (row) => `| ${row.cells.map((c) => runsToPlainText(c.runs)).join(" | ")} |`,
  );
  if (lines.length > 0) {
    const cols = rows[0]?.cells.length ?? 0;
    lines.splice(1, 0, `| ${new Array(cols).fill("---").join(" | ")} |`);
  }
  return lines.join("\n");
}

function quoteChildToSubBlock(child: DocBlock<ComposeAtomData>): RichTextSubBlock | undefined {
  if (child.kind === "paragraph") {
    return { elements: runsToInline(child.runs), type: "rich_text_section" };
  }
  if (child.kind === "codeblock") {
    return { elements: [{ text: child.text, type: "text" }], type: "rich_text_preformatted" };
  }
  if (child.kind === "list") {
    return {
      elements: child.items.map((item) => ({
        elements: runsToInline(child.style === "checkbox" ? checklistPrefix(item) : item.runs),
        type: "rich_text_section" as const,
      })),
      style: child.style === "ordered" ? "ordered" : "bullet",
      type: "rich_text_list",
    };
  }
}

/** Converts the editor's generic doc model into a real Slack `Block[]` — only ever `rich_text`,
 * `header` (level 1 only — Slack has one header size), `divider`, and `context`. Headings level
 * ≥2 and tables have no real Block Kit equivalent, so they degrade to bold text / a preformatted
 * pipe-table respectively rather than inventing new block schema. */
export function docToBlocks(doc: Doc): SlackBlock[] {
  const blocks: SlackBlock[] = [];
  let pending: RichTextSubBlock[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    blocks.push({ elements: pending, type: "rich_text" } as RichTextBlock as SlackBlock);
    pending = [];
  };

  for (const block of doc.blocks) {
    switch (block.kind) {
      case "paragraph":
        pending.push({ elements: runsToInline(block.runs), type: "rich_text_section" });
        break;
      case "heading":
        if (block.level <= 1) {
          flush();
          blocks.push({
            text: { text: runsToPlainText(block.runs), type: "plain_text" },
            type: "header",
          } as SlackBlock);
        } else {
          const boldRuns = block.runs.map((r) =>
            r.kind === "atom" ? r : { ...r, marks: [...new Set([...r.marks, "bold" as Mark])] },
          );
          pending.push({ elements: runsToInline(boldRuns), type: "rich_text_section" });
        }
        break;
      case "context":
        flush();
        blocks.push({
          elements: [{ text: runsToPlainText(block.runs), type: "mrkdwn" }],
          type: "context",
        } as SlackBlock);
        break;
      case "divider":
        flush();
        blocks.push({ type: "divider" } as SlackBlock);
        break;
      case "quote": {
        const elements = block.children
          .map(quoteChildToSubBlock)
          .filter((v): v is RichTextSubBlock => v !== undefined);
        pending.push({ elements, type: "rich_text_quote" });
        break;
      }
      case "codeblock":
        pending.push({
          elements: [{ text: block.text, type: "text" }],
          type: "rich_text_preformatted",
        });
        break;
      case "list":
        pending.push({
          elements: block.items.map((item) => ({
            elements: runsToInline(block.style === "checkbox" ? checklistPrefix(item) : item.runs),
            type: "rich_text_section" as const,
          })),
          style: block.style === "ordered" ? "ordered" : "bullet",
          type: "rich_text_list",
        });
        break;
      case "table":
        pending.push({
          elements: [{ text: tableToPipeText(block.rows), type: "text" }],
          type: "rich_text_preformatted",
        });
        break;
    }
  }
  flush();
  return blocks;
}
