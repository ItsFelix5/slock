import { chance, int, pick } from "../random";
import type { Obj } from "../slack";
import { imageUrl, longText, words } from "../text";
import type { World } from "../world";
import { context, divider, header, image, markdown, section, video } from "./basic";
import { actionsBlock, contextActions } from "./elements";
import { card, carousel, container, layout, plan, taskCard } from "./layouts";
import { dataTable, dataViz, richText, table } from "./rich";

export type Kind =
  | "chat"
  | "long"
  | "sections"
  | "interactive"
  | "richText"
  | "tables"
  | "markdown"
  | "cards"
  | "fiftyBlocks"
  | "legacy"
  | "video";

export type Message = { text: string; blocks?: Obj[]; attachments?: Obj[] };

const smallBlock = (w: World): Obj =>
  pick<(w: World) => Obj>([
    image,
    header,
    divider,
    (x) => ({ type: "section", text: { type: "mrkdwn", text: longText(x, int(1, 120)) } }),
  ])(w);

const legacy = (w: World): Obj => ({
  color: `#${int(0, 0xffffff).toString(16).padStart(6, "0")}`,
  pretext: words(4),
  author_name: words(2),
  author_link: "https://example.com",
  title: words(3),
  title_link: `https://example.com/${words(1)}`,
  text: longText(w, int(1, 3000)),
  fields: Array.from({ length: int(1, 8) }, () => ({
    title: words(2),
    value: words(3),
    short: chance(0.5),
  })),
  image_url: imageUrl(),
  footer: words(2),
  ts: 1795680000 + int(0, 9000000),
  fallback: words(5),
  mrkdwn_in: ["text", "fields"],
  actions: [{ type: "button", text: words(2), name: "go", value: "1", style: "primary" }],
});

const builders: Record<Kind, (w: World) => Message> = {
  chat: (w) => ({ text: longText(w, int(1, 400)) }),
  long: (w) => ({ text: longText(w, 39000) }),
  sections: (w) => ({
    text: words(4),
    blocks: [header(), section(w), section(w), divider(), image(w), context(w), section(w)],
  }),
  interactive: (w) => ({
    text: words(4),
    blocks: [section(w), actionsBlock(w), actionsBlock(w), contextActions(w), section(w)],
  }),
  richText: (w) => ({ text: words(3), blocks: [richText(w), richText(w), richText(w)] }),
  tables: (w) => ({ text: words(3), blocks: [table(w), dataTable(w), dataViz(), dataViz()] }),
  markdown: (w) => ({ text: words(3), blocks: [markdown(w, 12000)] }),
  cards: (w) => ({
    text: words(3),
    blocks: [carousel(w), container(w), layout(w), chance(0.5) ? plan(w) : taskCard(w), card(w)],
  }),
  fiftyBlocks: (w) => ({ text: words(3), blocks: Array.from({ length: 50 }, () => smallBlock(w)) }),
  legacy: (w) => ({
    text: words(3),
    attachments: Array.from({ length: int(1, 5) }, () => legacy(w)),
  }),
  video: () => ({ text: words(3), blocks: [video()] }),
};

export const messageOf = (kind: Kind, w: World): Message => builders[kind](w);
