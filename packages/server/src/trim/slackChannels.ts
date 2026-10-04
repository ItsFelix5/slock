import type {
  RawChannel,
  RawChannelProperties,
  RawChannelSection,
  RawChannelText,
  RawCountGroup,
  RawCounts,
} from "@slock/types";

export function trimCountGroup(group: RawCountGroup): RawCountGroup {
  return {
    has_unreads: group.has_unreads,
    id: group.id,
    is_unread: group.is_unread,
    last_read: group.last_read,
    latest: group.latest,
    mention_count: group.mention_count,
    mention_count_display: group.mention_count_display,
    unread_count: group.unread_count,
    unread_count_display: group.unread_count_display,
  };
}

export function trimCountGroups(
  data: RawCounts,
  trimGroup: (group: RawCountGroup) => RawCountGroup,
): RawCounts {
  return {
    channels: data.channels?.map(trimGroup),
    ims: data.ims?.map(trimGroup),
    mpims: data.mpims?.map(trimGroup),
  };
}

export function trimActivityCounts(
  activity: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
  if (!activity) return activity;
  return Object.fromEntries(
    Object.entries(activity).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

function trimChannelText(value: string | RawChannelText | undefined) {
  return typeof value === "string" || !value ? value : { value: value.value };
}

function trimChannelProperties(properties: RawChannelProperties): RawChannelProperties {
  return {
    canvas: properties.canvas?.file_id
      ? {
          file_id: properties.canvas.file_id,
          quip_thread_id: properties.canvas.quip_thread_id,
        }
      : undefined,
    channel_email_addresses: properties.channel_email_addresses?.map((entry) => ({
      address: entry.address,
    })),
    has_custom_mpdm_name: properties.has_custom_mpdm_name,
    tabs: properties.tabs?.map((tab) => ({
      data: tab.data ? { file_id: tab.data.file_id } : undefined,
      label: tab.label,
      type: tab.type,
    })),
  };
}

export function trimChannel(channel: RawChannel): RawChannel {
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
    is_record_channel: channel.is_record_channel,
    last_read: channel.last_read,
    latest: channel.latest,
    members: channel.members,
    member_count: channel.member_count,
    name: channel.name,
    num_members: channel.num_members,
    properties: channel.properties ? trimChannelProperties(channel.properties) : undefined,
    purpose: trimChannelText(channel.purpose),
    topic: trimChannelText(channel.topic),
    unread_count: channel.unread_count,
    unread_count_display: channel.unread_count_display,
  };
}

export function trimBootChannel(channel: RawChannel): RawChannel {
  return {
    created: channel.created,
    id: channel.id,
    is_archived: channel.is_archived,
    is_channel: channel.is_channel,
    is_group: channel.is_group,
    is_mpim: channel.is_mpim,
    is_private: channel.is_private,
    members: channel.is_mpim ? channel.members : undefined,
    name: channel.name,
    properties: channel.properties
      ? { has_custom_mpdm_name: channel.properties.has_custom_mpdm_name }
      : undefined,
    topic: trimChannelText(channel.topic),
    updated: channel.updated,
  };
}

export function trimChannelSection(section: RawChannelSection): RawChannelSection {
  return {
    channel_ids: section.channel_ids,
    channel_ids_page: section.channel_ids_page
      ? { channel_ids: section.channel_ids_page.channel_ids }
      : undefined,
    channel_section_id: section.channel_section_id,
    channels: section.channels,
    id: section.id,
    name: section.name,
    sidebar: section.sidebar,
    type: section.type,
  };
}
