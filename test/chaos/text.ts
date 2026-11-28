import { int, pick, uid } from "./random";
import type { World } from "./world";

const WORDS =
  `gremlin sourdough quantum yolo kubernetes lobster spreadsheet ferret hotfix standup vibes refactor
pineapple tensor migraine kombucha ledger blockchain nebula goblin vector canvas snack deploy rollback sprint cactus
glitch banana oatmeal latency cache websocket soup onboarding invoice meme thread draft pixel dumpling sprocket orbit
lattice gradient kernel fjord ember cosmic toaster rhythm velvet tundra mango saga widget parser lantern compass
biscuit hyperlink retry flux ghost signal anchor marble`.split(/\s+/);

export const EMOJI = [
  "tada",
  "fire",
  "rocket",
  "sob",
  "skull",
  "thinking_face",
  "eyes",
  "100",
  "pray",
  "wave",
  "zap",
  "bug",
  "sparkles",
  "warning",
  "white_check_mark",
  "x",
  "heart",
  "joy",
  "clown_face",
  "melting_face",
  "hot_face",
  "coffee",
  "pizza",
  "cat",
  "dog",
  "robot_face",
  "partying_face",
  "rainbow",
  "flushed",
  "nerd_face",
  "smiling_imp",
  "ghost",
  "alien",
  "pensive",
  "see_no_evil",
  "poop",
  "thumbsup",
  "raised_hands",
  "moyai",
  "hourglass",
];

const UNICODE_EMOJI = [
  "😀",
  "🔥",
  "🚀",
  "💀",
  "🧠",
  "🫠",
  "🥲",
  "🫡",
  "👀",
  "✨",
  "🐛",
  "🍕",
  "🧃",
  "🌈",
  "🦆",
  "🪩",
  "👨🏽‍💻",
  "🏳️‍🌈",
  "🇯🇵",
  "👩🏿‍🚀",
  "❤️‍🔥",
  "🧑‍🤝‍🧑",
];

const ZOO = [
  "مرحبا بالعالم",
  "שלום עולם",
  "你好，世界",
  "こんにちは世界",
  "नमस्ते दुनिया",
  "‮right to left‬",
  "zero​width",
  "é́́",
  "𝔐𝔞𝔱𝔥 𝔞𝔩𝔭𝔥𝔞𝔫𝔲𝔪𝔢𝔯𝔦𝔠",
  "ｆｕｌｌｗｉｄｔｈ",
  "a\tb\tc",
  "line\rreturn",
];

export const words = (count: number): string =>
  Array.from({ length: count }, () => pick(WORDS)).join(" ");

const zalgo = (s: string): string =>
  [...s]
    .map(
      (c) =>
        c +
        Array.from({ length: int(0, 8) }, () => String.fromCodePoint(0x300 + int(0, 0x6f))).join(
          "",
        ),
    )
    .join("");

export const codeBlob = (): string =>
  Array.from({ length: int(3, 40) }, () => words(int(3, 10))).join("\n");

export const imageUrl = (): string =>
  `https://picsum.photos/seed/${uid()}/${int(40, 1200)}/${int(40, 1200)}`;

const fragment = (w: World): string =>
  pick<() => string>([
    () => `*${words(int(1, 4))}*`,
    () => `_${words(int(1, 4))}_`,
    () => `~${words(int(1, 3))}~`,
    () => `\`${words(1)}\``,
    () => `*_~${words(2)}~_*`,
    () => `<https://example.com/${uid()}|${words(2)}>`,
    () => `https://example.com/${uid()}?q=${uid()}`,
    () => `<@${pick(w.users)}>`,
    () => `<#${pick(w.channels)}>`,
    () => `:${pick([...EMOJI, ...w.emoji])}:`,
    () => pick(UNICODE_EMOJI),
    () => zalgo(words(1)),
    () => pick(ZOO),
    () => pick(["&amp;", "&", "<", ">", "a<b", "5 > 3"]),
    () => words(int(1, 12)),
  ])();

const line = (w: World): string => Array.from({ length: int(2, 8) }, () => fragment(w)).join(" ");

export const longText = (w: World, max: number): string => {
  let out = "";
  while (out.length < max) out += `${line(w)}\n`;
  return out.slice(0, max);
};
