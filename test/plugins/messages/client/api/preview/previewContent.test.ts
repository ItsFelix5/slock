import { expect, test } from "bun:test";
import {
  attachmentContent,
  previewBody,
  previewImages,
  previewPlaceholder,
} from "../../../../../../packages/plugins/src/messages/client/api/preview/previewContent";
import type { Attachment, Block, SlackFile } from "../../../../../../packages/types/src";
import { fid } from "../../../../../support/slack";

const image: SlackFile = {
  id: fid("F1"),
  isImage: true,
  name: "img.png",
  thumbUrl: "https://files.slack.com/img.png",
  urlPrivate: "https://files.slack.com/img.png",
};

const forward = (rest: Attachment): Attachment => ({ isMessageUnfurl: true, ...rest });

const gifBlock: Block = {
  alt_text: "party parrot",
  image_url: "https://media.giphy.com/parrot.gif",
  type: "image",
};

test("a forwarded file is named like an attached one", () => {
  const content = { attachments: [forward({ files: [image], text: "" })], text: "" };
  expect(previewPlaceholder(content)).toEqual({ icon: "share-message", label: "img.png" });
  expect(previewImages(content).map((i) => i.src)).toEqual([image.thumbUrl ?? ""]);
});

test("a forward without text or files still gets a label", () => {
  const content = { attachments: [forward({})], text: "" };
  expect(previewPlaceholder(content)?.label).toBe("Forwarded message");
});

test("a gif inside attachment blocks gets a label and a thumbnail", () => {
  const content = { attachments: [{ blocks: [gifBlock], fallback: "[no preview]" }], text: "" };
  expect(previewPlaceholder(content)).toMatchObject({ icon: "gif", label: "party parrot" });
  expect(previewImages(content)).toHaveLength(1);
  expect(previewImages(attachmentContent({ blocks: [gifBlock] }))).toHaveLength(1);
});

test("an image block message has no text and shows as a gif", () => {
  const content = { blocks: [gifBlock], text: "fallback" };
  expect(previewBody(content)).toEqual({ blocks: undefined, text: "" });
  expect(previewPlaceholder(content)).toMatchObject({ icon: "gif", label: "party parrot" });
  expect(previewImages(content)).toHaveLength(1);
});

test("an attachment only message is labelled by its content", () => {
  const content = { attachments: [{ fallback: "build failed" }], text: "" };
  expect(previewPlaceholder(content)?.label).toBe("build failed");
});

test("a forwarded attachment lists each image once", () => {
  expect(previewImages(attachmentContent(forward({ files: [image] })))).toHaveLength(1);
});
