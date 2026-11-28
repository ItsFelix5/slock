import { safeMediaUrl } from "@slock/blockkit";
import { narrowByType } from "@slock/core";
import { fileSummaryIcon, fileSummaryLabel } from "@slock/plugins/files/client/api/fileSummary";
import type { Attachment, Block, ImageBlock, SlackFile } from "@slock/types";
import { type IconName, isGifUrl } from "@slock/ui";
import { isBareLinkUnfurl } from "../messageAuthor";

export interface PreviewContent {
  attachments?: Attachment[];
  blocks?: Block[];
  files?: SlackFile[];
  text: string;
}

interface Placeholder {
  icon: IconName;
  label: string;
  markdown?: boolean;
}

interface PreviewImage {
  alt: string;
  height?: number;
  src: string;
  width?: number;
}

const imageBlocks = (blocks: Block[] | undefined) =>
  blocks?.flatMap((block) => narrowByType<Block, ImageBlock>(block, "image") ?? []) ?? [];

const imageBlockUrl = (block: ImageBlock) => block.image_url ?? block.slack_file?.url;

export function previewBody({ blocks, text }: PreviewContent) {
  const textBlocks = blocks?.filter((block) => block.type !== "image");
  const imagesOnly = !!blocks?.length && !textBlocks?.length;
  return {
    blocks: textBlocks?.length ? textBlocks : undefined,
    text: imagesOnly || !text.trim() ? "" : text,
  };
}

function isFileImage(file: SlackFile) {
  return file.isImage && !file.isDeleted && !!safeMediaUrl(file.thumbUrl);
}

function forwardPlaceholder({ files, text }: Attachment): Placeholder {
  const icon = "share-message";
  if (text) return { icon, label: text, markdown: true };
  return { icon, label: files?.length ? fileSummaryLabel(files) : "Forwarded message" };
}

function mediaPlaceholder(url: string | undefined, title: string | undefined): Placeholder {
  const gif = isGifUrl(url);
  return {
    icon: gif ? "gif" : "image",
    label: title || (gif ? "GIF" : "Image"),
  };
}

const blockPlaceholder = (block: ImageBlock) =>
  mediaPlaceholder(imageBlockUrl(block), block.title?.text || block.alt_text);

export function previewPlaceholder({
  attachments,
  blocks,
  files,
}: PreviewContent): Placeholder | undefined {
  const forward = attachments?.find((a) => a.isMessageUnfurl);
  if (forward) return forwardPlaceholder(forward);
  if (files?.length)
    return {
      icon: fileSummaryIcon(files),
      label: fileSummaryLabel(files),
    };
  const [image] = imageBlocks(blocks);
  if (image) return blockPlaceholder(image);
  const attachment = attachments?.find((a) => !isBareLinkUnfurl(a));
  if (!attachment) return;
  const { fallback, imageUrl, pretext, serviceName, text, title } = attachment;
  if (!(pretext || title || text)) {
    const [nested] = imageBlocks(attachment.blocks);
    if (nested) return blockPlaceholder(nested);
    if (imageUrl) return mediaPlaceholder(imageUrl, undefined);
  }
  return {
    icon: "attachment",
    label: pretext || title || text || fallback || serviceName || "Attachment",
    markdown: true,
  };
}

function fileImages(files: SlackFile[] | undefined): PreviewImage[] {
  return (files ?? []).filter(isFileImage).map((file) => ({
    alt: file.title || file.name,
    height: file.height,
    src: file.thumbUrl ?? "",
    width: file.width,
  }));
}

function blockImages(blocks: Block[] | undefined): PreviewImage[] {
  return imageBlocks(blocks).map((block) => ({
    alt: block.alt_text,
    height: block.image_height,
    src: imageBlockUrl(block) ?? "",
    width: block.image_width,
  }));
}

export function previewImages({ attachments, blocks, files }: PreviewContent): PreviewImage[] {
  const attached = (attachments ?? []).flatMap((a) => [
    ...(a.imageUrl
      ? [{ alt: a.title ?? "", height: a.imageHeight, src: a.imageUrl, width: a.imageWidth }]
      : []),
    ...fileImages(a.files),
    ...blockImages(a.blocks),
  ]);
  return [...fileImages(files), ...blockImages(blocks), ...attached].filter((image) =>
    safeMediaUrl(image.src),
  );
}

export function attachmentContent(attachment: Attachment): PreviewContent {
  return {
    attachments: [{ ...attachment, blocks: undefined, files: undefined, isMessageUnfurl: false }],
    blocks: attachment.blocks,
    files: attachment.files,
    text: attachment.text ?? "",
  };
}
