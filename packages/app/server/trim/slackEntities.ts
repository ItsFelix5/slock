// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's wire field names.

function trimIcons(icons: any): any {
  if (!icons || typeof icons !== "object") return icons;
  return {
    image_32: icons.image_32,
    image_36: icons.image_36,
    image_48: icons.image_48,
    image_64: icons.image_64,
    image_72: icons.image_72,
  };
}

export function trimUser(user: any): any {
  if (!user || typeof user !== "object") return user;
  const profile = user.profile ?? {};
  return {
    color: user.color,
    deleted: user.deleted,
    id: user.id,
    is_bot: user.is_bot,
    name: user.name,
    presence: user.presence,
    profile: {
      api_app_id: profile.api_app_id,
      avatar_hash: profile.avatar_hash,
      bot_id: profile.bot_id,
      display_name: profile.display_name,
      email: profile.email,
      fields:
        profile.fields && typeof profile.fields === "object"
          ? Object.fromEntries(
              Object.entries(profile.fields).map(([id, field]: [string, any]) => [
                id,
                field ? { alt: field.alt, value: field.value } : field,
              ]),
            )
          : profile.fields,
      image_192: profile.image_192,
      image_48: profile.image_48,
      image_72: profile.image_72,
      phone: profile.phone,
      pronouns: profile.pronouns,
      real_name: profile.real_name,
      status_emoji: profile.status_emoji,
      status_text: profile.status_text,
      team: profile.team,
      title: profile.title,
    },
    real_name: user.real_name,
    team_id: user.team_id,
    tz: user.tz,
    tz_label: user.tz_label,
    tz_offset: user.tz_offset,
  };
}

export function trimFile(file: any): any {
  if (!file || typeof file !== "object") return file;
  return {
    audio_wave_samples: file.audio_wave_samples,
    duration: file.duration,
    duration_ms: file.duration_ms,
    filetype: file.filetype,
    id: file.id,
    mimetype: file.mimetype,
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
    title: file.title,
    transcription: file.transcription?.preview
      ? {
          preview: {
            content: file.transcription.preview.content,
            has_more: file.transcription.preview.has_more,
          },
        }
      : undefined,
    url_private: file.url_private,
  };
}

function trimAttachment(attachment: any): any {
  if (!attachment || typeof attachment !== "object") return attachment;
  return {
    author_icon: attachment.author_icon,
    author_name: attachment.author_name,
    blocks: attachment.blocks,
    channel_id: attachment.channel_id,
    color: attachment.color,
    fallback: attachment.fallback,
    fields: Array.isArray(attachment.fields)
      ? attachment.fields.map((field: any) => ({
          short: field?.short,
          title: field?.title,
          value: field?.value,
        }))
      : attachment.fields,
    files: Array.isArray(attachment.files) ? attachment.files.map(trimFile) : attachment.files,
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

export function trimMessage(message: any): any {
  if (!message || typeof message !== "object") return message;
  return {
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map(trimAttachment)
      : message.attachments,
    blocks: message.blocks,
    bot_id: message.bot_id,
    bot_profile: message.bot_profile
      ? { icons: trimIcons(message.bot_profile.icons), name: message.bot_profile.name }
      : undefined,
    edited: message.edited,
    files: Array.isArray(message.files) ? message.files.map(trimFile) : message.files,
    icons: trimIcons(message.icons),
    is_ephemeral: message.is_ephemeral,
    latest_reply: message.latest_reply,
    reactions: Array.isArray(message.reactions)
      ? message.reactions.map((reaction: any) => ({
          count: reaction?.count,
          name: reaction?.name,
          users: reaction?.users,
        }))
      : message.reactions,
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

// Shared by bootstrap.ts's client.counts trim and slackGatewayPayload.ts's
// badge_counts_updated trim — both trim the same channels/ims/mpims group
// arrays, just with slightly different per-group field sets (the gateway
// push omits last_read/latest, which its one consumer never reads, to keep
// this very-frequent event small).
export function trimCountGroups(data: any, trimGroup: (group: any) => any): any {
  return {
    channels: Array.isArray(data?.channels) ? data.channels.map(trimGroup) : data?.channels,
    ims: Array.isArray(data?.ims) ? data.ims.map(trimGroup) : data?.ims,
    mpims: Array.isArray(data?.mpims) ? data.mpims.map(trimGroup) : data?.mpims,
  };
}

export function trimBot(bot: any): any {
  if (!bot || typeof bot !== "object") return bot;
  return {
    app_id: bot.app_id,
    icons: trimIcons(bot.icons),
    id: bot.id,
    name: bot.name,
  };
}

export function trimChannel(channel: any): any {
  if (!channel || typeof channel !== "object") return channel;
  const trimText = (value: any) =>
    typeof value === "string" || !value ? value : { value: value.value };
  return {
    created: channel.created,
    creator: channel.creator,
    id: channel.id,
    is_archived: channel.is_archived,
    is_channel: channel.is_channel,
    is_group: channel.is_group,
    is_im: channel.is_im,
    is_member: channel.is_member,
    is_mpim: channel.is_mpim,
    is_private: channel.is_private,
    last_read: channel.last_read,
    latest: channel.latest,
    member_count: channel.member_count,
    name: channel.name,
    num_members: channel.num_members,
    properties: channel.properties
      ? {
          canvas: channel.properties.canvas
            ? {
                file_id: channel.properties.canvas.file_id,
                is_empty: channel.properties.canvas.is_empty,
              }
            : undefined,
          tabs: Array.isArray(channel.properties.tabs)
            ? channel.properties.tabs.map((tab: any) => ({
                data: { file_id: tab?.data?.file_id },
                id: tab?.id,
                label: tab?.label,
                type: tab?.type,
              }))
            : channel.properties.tabs,
          tabz: Array.isArray(channel.properties.tabz)
            ? channel.properties.tabz.map((tab: any) => ({
                data: { file_id: tab?.data?.file_id },
                id: tab?.id,
                label: tab?.label,
                type: tab?.type,
              }))
            : channel.properties.tabz,
          channel_email_addresses: Array.isArray(channel.properties.channel_email_addresses)
            ? channel.properties.channel_email_addresses.map((entry: any) => ({
                address: entry?.address,
              }))
            : channel.properties.channel_email_addresses,
        }
      : undefined,
    purpose: trimText(channel.purpose),
    topic: trimText(channel.topic),
    unread_count: channel.unread_count,
    unread_count_display: channel.unread_count_display,
  };
}

// Shared by routes/sections.ts's GET /api/sections and bootstrap.ts's
// conditional sections fan-out — both call users.channelSections.list
// directly via callSlack and trim its response the same way.
export function trimChannelSections(data: any): any {
  return {
    channel_sections: Array.isArray(data.channel_sections)
      ? data.channel_sections.map((section: any) => ({
          channel_ids: section?.channel_ids,
          channel_ids_page: section?.channel_ids_page
            ? { channel_ids: section.channel_ids_page.channel_ids }
            : undefined,
          channel_section_id: section?.channel_section_id,
          channels: section?.channels,
          id: section?.id,
          name: section?.name,
          sidebar: section?.sidebar,
          type: section?.type,
        }))
      : data.channel_sections,
    ok: true,
  };
}
