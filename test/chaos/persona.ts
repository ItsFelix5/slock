import { pick } from "./random";

const NAMES = [
  "Gremlin Gary",
  "Sourdough Sue",
  "Ferret Dev",
  "Lattice Lou",
  "Kombucha Kim",
  "Ember Bot",
  "Tensor Tina",
  "Pixel Pete",
  "Latency Larry",
  "Dumpling Dan",
  "Sprocket Sam",
  "Cactus Cara",
  "Hyperlink Hal",
  "Vector Vi",
  "Goblin Gus",
  "Biscuit Bea",
  "Toaster Tom",
  "Velvet Val",
  "Mango Max",
  "Lantern Lee",
  "Ghost Writer",
  "Ledger Lynn",
];

const ICONS = [
  "robot_face",
  "ghost",
  "alien",
  "frog",
  "cat",
  "dog",
  "fox_face",
  "octopus",
  "unicorn_face",
  "owl",
];

export const persona = (): { username: string; icon_emoji: string } => ({
  username: pick(NAMES),
  icon_emoji: `:${pick(ICONS)}:`,
});
