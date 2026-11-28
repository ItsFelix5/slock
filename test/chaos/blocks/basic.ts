import { chance, int, pick } from "../random";
import type { Obj } from "../slack";
import { imageUrl, longText, words } from "../text";
import type { World } from "../world";
import { accessory } from "./elements";

export const section = (w: World): Obj => ({
  type: "section",
  text: { type: "mrkdwn", text: longText(w, int(1, 2900)) },
  ...(chance(0.4)
    ? {
        fields: Array.from({ length: int(1, 10) }, () => ({
          type: "mrkdwn",
          text: longText(w, int(1, 1900)),
        })),
      }
    : {}),
  ...(chance(0.6) ? { accessory: accessory(w) } : {}),
});

export const header = (): Obj => ({
  type: "header",
  text: { type: "plain_text", text: words(int(1, 20)).slice(0, 150), emoji: true },
});

export const divider = (): Obj => ({ type: "divider" });

export const image = (w: World): Obj =>
  chance(0.3) && w.images.length > 0
    ? { type: "image", slack_file: { id: pick(w.images) }, alt_text: words(3) }
    : {
        type: "image",
        image_url: imageUrl(),
        alt_text: words(int(1, 30)),
        ...(chance(0.5) ? { title: { type: "plain_text", text: words(3) } } : {}),
      };

export const context = (w: World): Obj => ({
  type: "context",
  elements: Array.from({ length: int(1, 10) }, () =>
    chance(0.4)
      ? { type: "image", image_url: imageUrl(), alt_text: words(2) }
      : { type: pick(["mrkdwn", "plain_text"]), text: longText(w, int(1, 120)) },
  ),
});

export const markdown = (w: World, max: number): Obj => ({
  type: "markdown",
  text: longText(w, max),
});

export const video = (): Obj => ({
  type: "video",
  title: { type: "plain_text", text: words(5) },
  title_url: "https://www.youtube.com/watch?v=8876OZV_Yy0",
  description: { type: "plain_text", text: words(10) },
  video_url: "https://www.youtube.com/embed/8876OZV_Yy0?feature=oembed&autoplay=1",
  alt_text: words(5),
  thumbnail_url: "https://i.ytimg.com/vi/8876OZV_Yy0/hqdefault.jpg",
  author_name: words(2),
});
