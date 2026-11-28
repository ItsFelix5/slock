import type { Kind } from "./blocks";

export type ChannelSpec = {
  name: string;
  private?: boolean;
  messages: number;
  mix: [Kind, number][];
  threadReplies?: number;
  finish?: "archive" | "rename";
  voice?: "mixed" | "persona";
};

const EVERYTHING: [Kind, number][] = [
  ["chat", 30],
  ["long", 1],
  ["sections", 12],
  ["interactive", 10],
  ["richText", 12],
  ["tables", 6],
  ["markdown", 4],
  ["cards", 8],
  ["fiftyBlocks", 2],
  ["legacy", 4],
  ["video", 1],
];
const BLOCKS: [Kind, number][] = [
  ["sections", 15],
  ["interactive", 15],
  ["richText", 15],
  ["tables", 10],
  ["cards", 15],
  ["fiftyBlocks", 5],
  ["markdown", 5],
  ["video", 2],
];
const TEXT: [Kind, number][] = [
  ["chat", 60],
  ["long", 5],
  ["richText", 20],
  ["markdown", 10],
  ["legacy", 5],
];
const LIMITS: [Kind, number][] = [
  ["long", 30],
  ["fiftyBlocks", 30],
  ["markdown", 20],
  ["tables", 20],
  ["legacy", 10],
  ["video", 5],
];

export const CHANNELS: ChannelSpec[] = [
  { name: "chaos-firehose", messages: 6000, mix: EVERYTHING },
  { name: "chaos-vault", private: true, messages: 3000, mix: EVERYTHING },
  { name: "chaos-blocks", messages: 800, mix: BLOCKS },
  { name: "chaos-text", messages: 1500, mix: TEXT },
  { name: "chaos-threads", messages: 300, mix: TEXT, threadReplies: 1200 },
  { name: "chaos-reactions", messages: 600, mix: TEXT },
  { name: "chaos-edge", messages: 200, mix: LIMITS },
  { name: "chaos-tables", messages: 300, mix: [["tables", 100]] },
  { name: "chaos-cards", messages: 300, mix: [["cards", 100]] },
  {
    name: "chaos-legacy",
    messages: 200,
    mix: [
      ["legacy", 60],
      ["video", 10],
      ["chat", 30],
    ],
  },
  { name: "chaos-ghosts", messages: 150, mix: TEXT, finish: "archive" },
  { name: "chaos-renamed", messages: 150, mix: TEXT, finish: "rename" },
  { name: "chaos-files", messages: 40, mix: EVERYTHING },
  { name: "chaos-personas-hub", messages: 1500, mix: EVERYTHING, voice: "mixed" },
  { name: "chaos-personas-side", messages: 800, mix: TEXT, voice: "persona" },
  { name: "chaos-personas-vault", private: true, messages: 400, mix: BLOCKS, voice: "mixed" },
];
