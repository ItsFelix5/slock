import type { IconName } from "@slock/ui";
import type Quill from "quill";
import type { CommandSuggestItem } from "../../components/composer/lib/suggestTypes";
import { CALLOUT_COLORS, DEFAULT_CALLOUT_COLOR } from "./canvasCallouts";
import { COLUMNS_EMBED, DIVIDER_EMBED, IMAGE_EMBED, TABLE_EMBED } from "./canvasEmbedValues";
import {
  insertColumns,
  insertDivider,
  insertTable,
  setCallout,
  setParagraph,
  toggleBlock,
  toggleQuote,
} from "./canvasFormatting";

export interface CanvasCommandContext {
  comment: () => void;
  newId: () => string;
  pickDate: () => void;
  pickFiles: () => void;
  react: () => void;
}

interface CanvasCommand {
  icon: IconName;
  name: string;
  requires?: string;
  run: (quill: Quill, context: CanvasCommandContext) => void;
}

const heading = (level: number, icon: IconName): CanvasCommand => ({
  icon,
  name: `Heading ${level}`,
  run: (quill) => toggleBlock(quill, "header", level),
});

const list = (value: string, icon: IconName, name: string): CanvasCommand => ({
  icon,
  name,
  run: (quill) => toggleBlock(quill, "list", value),
});

const callout = (name: string, color: number): CanvasCommand => ({
  icon: "callout",
  name,
  requires: "layout",
  run: (quill) => setCallout(quill, color),
});

const COMMANDS: CanvasCommand[] = [
  { icon: "paragraph", name: "Text", run: setParagraph },
  heading(1, "heading-1"),
  heading(2, "heading-2"),
  heading(3, "heading-3"),
  list("bullet", "bulleted-list", "Bulleted list"),
  list("ordered", "numbered-list", "Numbered list"),
  list("unchecked", "check-list", "Checklist"),
  { icon: "quote", name: "Quote", run: toggleQuote },
  {
    icon: "code-block",
    name: "Code block",
    run: (quill) => toggleBlock(quill, "code-block", true),
  },
  callout("Callout", DEFAULT_CALLOUT_COLOR),
  ...CALLOUT_COLORS.filter(({ value }) => value !== DEFAULT_CALLOUT_COLOR).map(({ name, value }) =>
    callout(`${name} callout`, value),
  ),
  {
    icon: "table",
    name: "Table",
    requires: TABLE_EMBED,
    run: (quill, { newId }) => insertTable(quill, newId),
  },
  {
    icon: "column-two",
    name: "Two columns",
    requires: COLUMNS_EMBED,
    run: (quill, { newId }) => insertColumns(quill, 2, newId),
  },
  {
    icon: "column-three",
    name: "Three columns",
    requires: COLUMNS_EMBED,
    run: (quill, { newId }) => insertColumns(quill, 3, newId),
  },
  {
    icon: "divider",
    name: "Divider",
    requires: DIVIDER_EMBED,
    run: (quill, { newId }) => insertDivider(quill, newId()),
  },
  {
    icon: "attachment",
    name: "Image or file",
    requires: IMAGE_EMBED,
    run: (_quill, { pickFiles }) => pickFiles(),
  },
  { icon: "calendar", name: "Date", run: (_quill, { pickDate }) => pickDate() },
  { icon: "add-comment", name: "Comment", run: (_quill, { comment }) => comment() },
  { icon: "add-reaction", name: "React", run: (_quill, { react }) => react() },
];

const available = (quill: Quill) =>
  COMMANDS.filter(({ requires }) => !requires || quill.scroll.query(requires));

export function canvasCommandItems(quill: Quill | undefined): CommandSuggestItem[] {
  if (!quill) return [];
  return available(quill).map(({ icon, name }) => ({
    desc: "",
    iconName: icon,
    kind: "command",
    name,
  }));
}

export function runCanvasCommand(name: string, quill: Quill, context: CanvasCommandContext) {
  available(quill)
    .find((command) => command.name === name)
    ?.run(quill, context);
}
