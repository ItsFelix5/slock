import type { Attachment, Block, SlackFile } from "@slock/slack-api";

const LINE_HEIGHT = 22;
const ATTACHMENT_LINE_HEIGHT = 18;
const AVG_CHAR_WIDTH = 7.2;
const FILE_GAP = 6;
const FILES_MARGIN_TOP = 4;
const FILE_IMAGE_MAX_WIDTH = 360;
const FILE_IMAGE_MAX_HEIGHT = 320;
const ATTACHMENT_IMAGE_MAX_WIDTH = 240;
const ATTACHMENT_IMAGE_MAX_HEIGHT = 200;
const UNKNOWN_FILE_IMAGE_HEIGHT = 180;
const UNKNOWN_ATTACHMENT_IMAGE_HEIGHT = 160;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
  } catch {
    measureCtx = null;
  }
  return measureCtx ?? null;
}

export function estimateLineCount(text: string, wrapWidth: number): number {
  if (!text) return 0;
  const ctx = getMeasureContext();
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines += 1;
      continue;
    }
    const width = ctx ? ctx.measureText(paragraph).width : paragraph.length * AVG_CHAR_WIDTH;
    lines += Math.max(1, Math.ceil(width / wrapWidth));
  }
  return lines;
}

export function estimateMrkdwnHeight(
  text: string,
  wrapWidth: number,
  lineHeight = LINE_HEIGHT,
): number {
  if (!text) return 0;
  let height = 0;
  let lastIndex = 0;
  for (const match of text.matchAll(/```([\s\S]*?)```/g)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      height += estimateLineCount(text.slice(lastIndex, index), wrapWidth) * lineHeight;
    height += Math.max(1, estimateLineCount(match[1], Math.max(40, wrapWidth - 20))) * 18 + 18;
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length)
    height += estimateLineCount(text.slice(lastIndex), wrapWidth) * lineHeight;
  const quoteGroups = text.match(/(?:^|\n)&gt;[^\n]*(?:\n&gt;[^\n]*)*/g)?.length ?? 0;
  return height + quoteGroups * 8;
}

export function constrainMediaDimensions(
  width: number | undefined,
  height: number | undefined,
  maxWidth: number,
  maxHeight: number,
  fallbackWidth: number,
  fallbackHeight: number,
  allowUpscale = false,
): { width: number; height: number } {
  if (!(width && height && width > 0 && height > 0))
    return { height: fallbackHeight, width: fallbackWidth };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const constrainedScale = allowUpscale ? scale : Math.min(1, scale);
  return {
    height: Math.round(height * constrainedScale),
    width: Math.round(width * constrainedScale),
  };
}

function estimateFileHeight(file: SlackFile, wrapWidth: number): number {
  const maxWidth = Math.min(FILE_IMAGE_MAX_WIDTH, wrapWidth);
  if (file.isImage && file.thumbUrl)
    return constrainMediaDimensions(
      file.width,
      file.height,
      maxWidth,
      FILE_IMAGE_MAX_HEIGHT,
      maxWidth,
      UNKNOWN_FILE_IMAGE_HEIGHT,
      true,
    ).height;
  if (file.isVideo)
    return constrainMediaDimensions(
      file.width,
      file.height,
      maxWidth,
      FILE_IMAGE_MAX_HEIGHT,
      maxWidth,
      180,
    ).height;
  if (file.isAudio) {
    const transcript = file.transcriptionPreview
      ? 13 * estimateLineCount(file.transcriptionPreview, Math.max(80, maxWidth - 24)) + 13
      : 0;
    return 50 + transcript;
  }
  return 38;
}

export function estimateFilesHeight(files: SlackFile[] | undefined, wrapWidth: number): number {
  if (!files?.length) return 0;
  return (
    FILES_MARGIN_TOP +
    files.reduce((sum, file) => sum + estimateFileHeight(file, wrapWidth), 0) +
    FILE_GAP * Math.max(0, files.length - 1)
  );
}

function estimateAttachmentFieldsHeight(
  fields: NonNullable<Attachment["fields"]>,
  wrapWidth: number,
): number {
  let height = 6;
  let pendingShortHeight = 0;
  const shortWidth = Math.max(40, (wrapWidth - 8) / 2);
  const fieldHeight = (field: (typeof fields)[number], width: number) =>
    15 * Math.max(1, estimateLineCount(field.title, width)) +
    16 * Math.max(1, estimateLineCount(field.value, width));

  for (const field of fields) {
    if (!field.short) {
      if (pendingShortHeight) {
        height += pendingShortHeight + 8;
        pendingShortHeight = 0;
      }
      height += fieldHeight(field, wrapWidth) + 8;
      continue;
    }
    const nextHeight = fieldHeight(field, shortWidth);
    if (pendingShortHeight) {
      height += Math.max(pendingShortHeight, nextHeight) + 8;
      pendingShortHeight = 0;
    } else pendingShortHeight = nextHeight;
  }
  return pendingShortHeight ? height + pendingShortHeight : Math.max(0, height - 8);
}

export function estimateAttachmentHeight(
  attachment: Attachment,
  wrapWidth: number,
  estimateBlocksHeight: (blocks: Block[], width: number) => number,
): number {
  const attachmentWidth = Math.min(433, wrapWidth);
  let height = 22;
  if (attachment.isMessageUnfurl && attachment.fromUrl) height += 24;
  if (attachment.pretext)
    height += 6 + estimateMrkdwnHeight(attachment.pretext, wrapWidth, ATTACHMENT_LINE_HEIGHT);
  if (attachment.authorName) height += 18;
  if (attachment.title) height += 19;
  if (attachment.blocks?.length) height += estimateBlocksHeight(attachment.blocks, attachmentWidth);
  else {
    const body = attachment.text || attachment.fallback;
    if (body) height += estimateMrkdwnHeight(body, attachmentWidth, ATTACHMENT_LINE_HEIGHT);
  }
  if (attachment.fields?.length)
    height += estimateAttachmentFieldsHeight(attachment.fields, attachmentWidth);
  if (attachment.videoUrl)
    height +=
      6 +
      constrainMediaDimensions(
        attachment.videoWidth,
        attachment.videoHeight,
        Math.min(ATTACHMENT_IMAGE_MAX_WIDTH, attachmentWidth),
        ATTACHMENT_IMAGE_MAX_HEIGHT,
        Math.min(ATTACHMENT_IMAGE_MAX_WIDTH, attachmentWidth),
        UNKNOWN_ATTACHMENT_IMAGE_HEIGHT,
        true,
      ).height;
  else if (attachment.imageUrl)
    height +=
      6 +
      constrainMediaDimensions(
        attachment.imageWidth,
        attachment.imageHeight,
        Math.min(ATTACHMENT_IMAGE_MAX_WIDTH, attachmentWidth),
        ATTACHMENT_IMAGE_MAX_HEIGHT,
        Math.min(ATTACHMENT_IMAGE_MAX_WIDTH, attachmentWidth),
        UNKNOWN_ATTACHMENT_IMAGE_HEIGHT,
      ).height;
  height += estimateFilesHeight(attachment.files, attachmentWidth);
  if (attachment.footer || (attachment.isMessageUnfurl && attachment.channelId)) height += 21;
  return height;
}
