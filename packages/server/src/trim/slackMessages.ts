import type { RawAttachment, RawFile, RawMessage } from "@slock/types";
import { trimIcons } from "./slackEntities.ts";

export function trimFile(file: RawFile): RawFile {
  return {
    audio_wave_samples: file.audio_wave_samples,
    created: file.created,
    duration: file.duration,
    duration_ms: file.duration_ms,
    filetype: file.filetype,
    id: file.id,
    mimetype: file.mimetype,
    mode: file.mode,
    name: file.name,
    original_h: file.original_h,
    original_w: file.original_w,
    permalink: file.permalink,
    size: file.size,
    thumb_160: file.thumb_160,
    thumb_360: file.thumb_360,
    thumb_360_h: file.thumb_360_h,
    thumb_360_w: file.thumb_360_w,
    thumb_480: file.thumb_480,
    thumb_480_h: file.thumb_480_h,
    thumb_480_w: file.thumb_480_w,
    thumb_720: file.thumb_720,
    thumb_720_h: file.thumb_720_h,
    thumb_720_w: file.thumb_720_w,
    thumb_800: file.thumb_800,
    thumb_800_h: file.thumb_800_h,
    thumb_800_w: file.thumb_800_w,
    thumb_tiny: file.thumb_tiny,
    thumb_video: file.thumb_video,
    thumb_video_h: file.thumb_video_h,
    thumb_video_w: file.thumb_video_w,
    title: file.title,
    transcription: file.transcription
      ? {
          lines: file.transcription.lines?.map((line) => ({
            contents: line.contents,
            end_time_ms: line.end_time_ms,
            start_time_ms: line.start_time_ms,
          })),
          preview: file.transcription.preview
            ? {
                content: file.transcription.preview.content,
                has_more: file.transcription.preview.has_more,
              }
            : undefined,
        }
      : undefined,
    url_private: file.url_private,
    url_private_download: file.url_private_download,
    vtt: file.vtt,
  };
}

function trimAttachment(attachment: RawAttachment): RawAttachment {
  return {
    actions: attachment.actions?.map((action) => ({
      name: action.name,
      style: action.style,
      text: action.text,
      type: action.type,
      url: action.url,
      value: action.value,
    })),
    author_icon: attachment.author_icon,
    author_id: attachment.author_id,
    author_name: attachment.author_name,
    author_subname: attachment.author_subname,
    blocks: attachment.blocks,
    callback_id: attachment.callback_id,
    channel_id: attachment.channel_id,
    color: attachment.color,
    fallback: attachment.fallback,
    fields: attachment.fields?.map((field) => ({
      short: field.short,
      title: field.title,
      value: field.value,
    })),
    files: attachment.files?.map(trimFile),
    footer: attachment.footer,
    footer_icon: attachment.footer_icon,
    from_url: attachment.from_url,
    id: attachment.id,
    image_height: attachment.image_height,
    image_url: attachment.image_url,
    image_width: attachment.image_width,
    is_msg_unfurl: attachment.is_msg_unfurl,
    is_reply_unfurl: attachment.is_reply_unfurl,
    pretext: attachment.pretext,
    text: attachment.text,
    title: attachment.title,
    title_link: attachment.title_link,
    ts: attachment.ts,
    video_height: attachment.video_height,
    video_url: attachment.video_url,
    video_width: attachment.video_width,
  };
}

export function trimMessage(message: RawMessage): RawMessage {
  return {
    attachments: message.attachments?.map(trimAttachment),
    blocks: message.blocks,
    bot_id: message.bot_id,
    bot_profile: message.bot_profile
      ? {
          icons: trimIcons(message.bot_profile.icons),
          name: message.bot_profile.name,
        }
      : undefined,
    document_comment: message.document_comment,
    edited: message.edited,
    files: message.files?.map(trimFile),
    icons: trimIcons(message.icons),
    is_ephemeral: message.is_ephemeral,
    latest_reply: message.latest_reply,
    metadata: message.metadata,
    reactions: message.reactions?.map((reaction) => ({
      count: reaction.count,
      name: reaction.name,
      users: reaction.users,
    })),
    reply_count: message.reply_count,
    reply_users: message.reply_users,
    root: message.root ? trimMessage(message.root) : undefined,
    subscribed: message.subscribed,
    subtype: message.subtype,
    text: message.text,
    thread_ts: message.thread_ts,
    ts: message.ts,
    type: message.type,
    user: message.user,
    username: message.username,
  };
}
