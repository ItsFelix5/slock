// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's own wire field names.
// client.userBoot and client.counts carry a lot more than this client ever
// reads — full prefs blobs, subteams, canvases, workflows, every channel's
// full metadata — that on a large Grid workspace can run several megabytes,
// none of which needs to leave the relay. Trims each down to exactly the
// fields packages/slack-api's bootstrap.ts (RawBoot/RawCounts/RawUser) reads,
// so this has to stay in lockstep with that file if either one changes.

function trimUser(u: any): any {
  if (!u || typeof u !== "object") return u;
  const p = u.profile ?? {};
  return {
    color: u.color,
    id: u.id,
    is_bot: u.is_bot,
    name: u.name,
    presence: u.presence,
    profile: {
      api_app_id: p.api_app_id,
      avatar_hash: p.avatar_hash,
      bot_id: p.bot_id,
      display_name: p.display_name,
      email: p.email,
      fields: p.fields,
      image_192: p.image_192,
      image_48: p.image_48,
      image_72: p.image_72,
      phone: p.phone,
      pronouns: p.pronouns,
      real_name: p.real_name,
      status_emoji: p.status_emoji,
      status_text: p.status_text,
      team: p.team,
      title: p.title,
    },
    real_name: u.real_name,
    team_id: u.team_id,
    tz: u.tz,
    tz_label: u.tz_label,
    tz_offset: u.tz_offset,
  };
}

function trimChannel(c: any): any {
  return {
    id: c?.id,
    is_channel: c?.is_channel,
    is_group: c?.is_group,
    is_private: c?.is_private,
    name: c?.name,
    topic: c?.topic,
  };
}

function trimIm(im: any): any {
  return {
    created: im?.created,
    id: im?.id,
    is_open: im?.is_open,
    updated: im?.updated,
    user: im?.user,
  };
}

function trimMpim(g: any): any {
  return {
    created: g?.created,
    id: g?.id,
    is_open: g?.is_open,
    members: g?.members,
    updated: g?.updated,
  };
}

function trimStarred(s: any): any {
  return typeof s === "string" ? s : { channel: s?.channel, id: s?.id };
}

function trimUserBoot(data: any): any {
  if (!data?.ok) return data;
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimChannel) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimIm) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimMpim) : data.mpims,
    ok: data.ok,
    self: trimUser(data.self),
    starred: Array.isArray(data.starred) ? data.starred.map(trimStarred) : data.starred,
  };
}

function trimCountGroup(c: any): any {
  return {
    has_unreads: c?.has_unreads,
    id: c?.id,
    is_unread: c?.is_unread,
    last_read: c?.last_read,
    latest: c?.latest,
    mention_count: c?.mention_count,
    mention_count_display: c?.mention_count_display,
    unread_count: c?.unread_count,
    unread_count_display: c?.unread_count_display,
  };
}

function trimCounts(data: any): any {
  if (!data?.ok) return data;
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimCountGroup) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimCountGroup) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimCountGroup) : data.mpims,
    ok: data.ok,
  };
}

export function trimSlackResponse(method: string, data: any): any {
  if (method === "client.userBoot") return trimUserBoot(data);
  if (method === "client.counts") return trimCounts(data);
  return data;
}
