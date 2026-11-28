import { formatDay, formatTime, logUnknown } from "@slock/core";
import { service } from "@slock/core/services";
import type { Attachment, RawAttachment, RawFile, SlackFile } from "@slock/types";
import { ifPresent, isUserId, parseChannelId, parseFileId, parseTs } from "../ids";
import { decodeTextEntities } from "../richText/entities";

const env = service("env");

const IFRAME_SRC_RE = /<iframe\b[^>]*?\ssrc="([^"]+)"/i;

const EXTENSION_MIMETYPES = new Map(
  Object.entries({
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
  }),
);

function extensionOf(name: string | undefined): string | undefined {
  const dot = name?.lastIndexOf(".") ?? -1;
  return name && dot >= 0 ? name.slice(dot + 1).toLowerCase() : undefined;
}

export function mapFile(f: RawFile): SlackFile {
  const filetype = f.filetype || extensionOf(f.name);
  const mimetype = f.mimetype || (filetype ? EXTENSION_MIMETYPES.get(filetype) : undefined);

  const hasWaveform = Array.isArray(f.audio_wave_samples);
  const isAudio = hasWaveform || !!mimetype?.startsWith("audio/");

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
    id: parseFileId(f.id),
    isAudio,
    isDeleted: f.mode === "tombstone" || !f.created,
    isImage: !!mimetype?.startsWith("image/"),
    isMail: mimetype === "message/rfc822" || filetype === "eml" || filetype === "email",
    isPdf: mimetype === "application/pdf" || filetype === "pdf",
    isVideo: !isAudio && !!mimetype?.startsWith("video/"),
    mimetype,
    name: f.name ?? "file",
    permalink: f.permalink,
    size: f.size,
    thumbTiny: f.thumb_tiny,
    thumbUrl: thumb
      ? thumb.url
      : mimetype?.startsWith("image/") && f.url_private
        ? f.url_private
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
    urlPrivateDownload: f.url_private_download ? f.url_private_download : undefined,
    userId: f.user && isUserId(f.user) ? f.user : undefined,
    vtt: f.vtt || undefined,
    waveform: hasWaveform ? f.audio_wave_samples : undefined,
    width: thumb?.w ?? f.original_w,
  };
}

export function mapAttachment(a: RawAttachment): Attachment {
  const embedSrc = IFRAME_SRC_RE.exec(a.video_html ?? "")?.[1];
  const image = a.image_url
    ? { height: a.image_height, url: a.image_url, width: a.image_width }
    : { height: a.thumb_height, url: a.thumb_url || undefined, width: a.thumb_width };
  return {
    actions: a.actions?.flatMap(({ id, name = id, style, text, type, url, value }) => {
      if (type !== "button") logUnknown("attachment action", type);
      return type === "button" && name && text ? [{ name, style, text, url, value }] : [];
    }),
    authorIcon: a.author_icon || undefined,
    authorId: a.author_id && isUserId(a.author_id) ? a.author_id : undefined,
    authorLink: a.author_link,
    authorName: a.author_name,
    authorSubname: a.author_subname,
    blocks: a.blocks,
    botId: a.bot_id,
    botTeamId: a.bot_team_id,
    callbackId: a.callback_id,
    channelId: ifPresent(parseChannelId, a.channel_id),
    color: a.color,
    embedUrl: ifPresent(decodeTextEntities, embedSrc),
    fallback: a.fallback,
    fields: a.fields,
    files: Array.isArray(a.files) ? a.files.map(mapFile) : undefined,
    footer: a.footer,
    footerIcon: a.footer_icon || undefined,
    fromUrl: a.from_url,
    id: a.id,
    imageHeight: image.height,
    imageUrl: image.url,
    imageWidth: image.width,
    isMessageUnfurl: !!(a.is_reply_unfurl || a.is_msg_unfurl),
    postedAt: a.ts ? `${formatDay(a.ts, env.now())} at ${formatTime(a.ts)}` : undefined,
    pretext: a.pretext,
    serviceIcon: a.service_icon,
    serviceName: a.service_name,
    text: a.text,
    title: a.title,
    titleLink: a.title_link,
    ts: ifPresent(parseTs, a.ts),
    videoHeight: a.video_height,
    videoUrl: a.video_url || undefined,
    videoWidth: a.video_width,
  };
}
