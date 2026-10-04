import type { Attachment, SlackFile, SlackFileShare, SlackLink } from "./fileTypes";
import { formatDay, formatTime } from "./mapTime";
import type { RawAttachment, RawFile, RawFileShare, RawLink } from "./rawTypes";
import { resolveMediaUrl } from "./server";

const EXTENSION_MIMETYPES: Record<string, string> = {
  aac: "audio/aac",
  avi: "video/x-msvideo",
  bmp: "image/bmp",
  flac: "audio/flac",
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  png: "image/png",
  svg: "image/svg+xml",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

export function mapFile(f: RawFile): SlackFile {
  const filetype = f.filetype || f.name?.split(".").pop()?.toLowerCase();
  const mimetype = f.mimetype || (filetype ? EXTENSION_MIMETYPES[filetype] : undefined);

  const thumb =
    (f.thumb_800 && f.thumb_800_w && f.thumb_800_h
      ? { h: f.thumb_800_h, url: f.thumb_800, w: f.thumb_800_w }
      : undefined) ??
    (f.thumb_720 && f.thumb_720_w && f.thumb_720_h
      ? { h: f.thumb_720_h, url: f.thumb_720, w: f.thumb_720_w }
      : undefined) ??
    (f.thumb_480 && f.thumb_480_w && f.thumb_480_h
      ? { h: f.thumb_480_h, url: f.thumb_480, w: f.thumb_480_w }
      : undefined) ??
    (f.thumb_360 && f.thumb_360_w && f.thumb_360_h
      ? { h: f.thumb_360_h, url: f.thumb_360, w: f.thumb_360_w }
      : undefined) ??
    (f.thumb_160 ? { h: f.original_h, url: f.thumb_160, w: f.original_w } : undefined) ??
    (f.thumb_video ? { h: f.thumb_video_h, url: f.thumb_video, w: f.thumb_video_w } : undefined);
  return {
    created: f.created,

    duration: f.duration ?? (typeof f.duration_ms === "number" ? f.duration_ms / 1000 : undefined),
    filetype,
    height: thumb?.h ?? f.original_h,
    id: f.id,
    isAudio: !!mimetype?.startsWith("audio/"),
    isDeleted: f.mode === "tombstone",
    isImage: !!mimetype?.startsWith("image/"),
    isMail: mimetype === "message/rfc822" || filetype === "eml",
    isPdf: mimetype === "application/pdf" || filetype === "pdf",
    isVideo: !!mimetype?.startsWith("video/"),
    mimetype,
    name: f.name ?? "file",
    permalink: f.permalink,
    size: f.size,
    thumbTiny: f.thumb_tiny,
    thumbUrl: thumb
      ? resolveMediaUrl(thumb.url)
      : mimetype?.startsWith("image/") && f.url_private
        ? resolveMediaUrl(f.url_private)
        : undefined,
    title: f.title,
    transcriptionHasMore: f.transcription?.preview?.has_more,
    transcriptionLines: f.transcription?.lines?.map((line) => ({
      endMs: line.end_time_ms ?? 0,
      startMs: line.start_time_ms ?? 0,
      text: line.contents ?? "",
    })),
    transcriptionPreview: f.transcription?.preview?.content,

    urlPrivate: f.url_private ?? "",
    urlPrivateDownload: f.url_private_download
      ? resolveMediaUrl(f.url_private_download)
      : undefined,
    vtt: f.vtt ? resolveMediaUrl(f.vtt) : undefined,
    waveform: Array.isArray(f.audio_wave_samples) ? f.audio_wave_samples : undefined,
    width: thumb?.w ?? f.original_w,
  };
}

export function mapLink(raw: RawLink): SlackLink {
  return {
    iconUrl: raw.icon_url ? resolveMediaUrl(raw.icon_url) : undefined,
    thumbHeight: raw.thumb_height ?? undefined,
    thumbUrl: raw.thumb_url ? resolveMediaUrl(raw.thumb_url) : undefined,
    thumbWidth: raw.thumb_width ?? undefined,
    title: raw.title,
    ts: raw.timestamp,
    url: raw.url,
  };
}

export function mapFileShare(raw: RawFileShare): SlackFileShare {
  return {
    channelId: raw.channel_id,
    channelName: raw.channel_name ?? raw.channel_id,
    replyCount: raw.reply_count,
    sharedByUserId: raw.share_user_id,
    threadTs: raw.thread_ts,
    ts: raw.ts,
  };
}

export function mapAttachment(a: RawAttachment): Attachment {
  return {
    actions: a.actions?.flatMap((action) =>
      action.type === "button" && action.name && action.text
        ? [
            {
              name: action.name,
              style: action.style,
              text: action.text,
              url: action.url,
              value: action.value,
            },
          ]
        : [],
    ),
    authorIcon: a.author_icon ? resolveMediaUrl(a.author_icon) : undefined,
    authorId: a.author_id,
    authorName: a.author_name,
    authorSubname: a.author_subname,
    blocks: a.blocks,
    callbackId: a.callback_id,
    channelId: a.channel_id,
    color: a.color,
    fallback: a.fallback,
    fields: a.fields,
    files: Array.isArray(a.files) ? a.files.map(mapFile) : undefined,
    footer: a.footer,
    footerIcon: a.footer_icon ? resolveMediaUrl(a.footer_icon) : undefined,
    fromUrl: a.from_url,
    id: a.id,
    imageHeight: a.image_height,
    imageUrl: a.image_url ? resolveMediaUrl(a.image_url) : undefined,
    imageWidth: a.image_width,
    isMessageUnfurl: !!(a.is_reply_unfurl || a.is_msg_unfurl),
    postedAt: a.ts ? `${formatDay(a.ts)} at ${formatTime(a.ts)}` : undefined,
    pretext: a.pretext,
    text: a.text,
    title: a.title,
    titleLink: a.title_link,
    ts: a.ts,
    videoHeight: a.video_height,
    videoUrl: a.video_url ? resolveMediaUrl(a.video_url) : undefined,
    videoWidth: a.video_width,
  };
}
