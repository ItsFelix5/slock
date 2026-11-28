import { chance, int, pick, uid } from "../random";
import type { Obj } from "../slack";
import { imageUrl, words } from "../text";
import type { World } from "../world";
import { context, divider, image, section } from "./basic";
import { element } from "./elements";
import { richText } from "./rich";

const status = (): string => pick(["in_progress", "complete", "error"]);

export const card = (w: World): Obj => ({
  type: "card",
  icon: { type: "image", image_url: imageUrl(), alt_text: "icon" },
  ...(chance(0.6)
    ? { hero_image: { type: "image", image_url: imageUrl(), alt_text: words(3) } }
    : {}),
  title: { type: "mrkdwn", text: words(int(1, 8)).slice(0, 150), verbatim: false },
  subtitle: { type: "mrkdwn", text: words(int(1, 12)).slice(0, 150), verbatim: false },
  body: { type: "mrkdwn", text: words(int(1, 30)).slice(0, 200), verbatim: false },
  actions: Array.from({ length: int(1, 3) }, () => element("button", w)),
});

export const carousel = (w: World): Obj => ({
  type: "carousel",
  elements: Array.from({ length: int(1, 10) }, () => ({ ...card(w), block_id: uid() })),
});

export const container = (w: World): Obj => ({
  type: "container",
  title: { type: "plain_text", text: words(3) },
  subtitle: { type: "plain_text", text: words(5) },
  is_collapsible: chance(0.5),
  child_blocks: Array.from({ length: int(1, 10) }, () =>
    pick<(w: World) => Obj>([section, image, context, () => divider()])(w),
  ),
});

export const layout = (w: World): Obj => ({
  type: "layout",
  block_id: uid(),
  label: words(3),
  is_label_visible: chance(0.7),
  rows: Array.from({ length: int(1, 5) }, () => ({
    items: Array.from({ length: int(1, 3) }, () => ({
      block: pick<(w: World) => Obj>([section, image, card])(w),
    })),
  })),
});

const task = (w: World): Obj => ({
  task_id: uid(),
  title: words(4),
  status: status(),
  details: richText(w),
  output: richText(w),
});

export const plan = (w: World): Obj => ({
  type: "plan",
  title: words(3),
  tasks: Array.from({ length: int(1, 50) }, () => task(w)),
});

export const taskCard = (w: World): Obj => ({
  type: "task_card",
  task_id: uid(),
  title: words(4),
  status: status(),
  output: richText(w),
  sources: Array.from({ length: int(0, 3) }, () => ({
    type: "url",
    url: `https://example.com/${uid()}`,
    text: words(2),
  })),
});
