// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ChannelSection } from "../../../types";
import { extractChannelSections } from "../../mappers";
import { callSlack } from "../../relay";
import { fetchInitialData } from "../initialData";
import {
  type PairedPreferenceValues,
  writePairedPreference,
} from "../preferences/pairedPreferenceWrite";

export async function fetchSections(): Promise<ChannelSection[]> {
  const initial = await fetchInitialData();
  const data = initial.sections ?? (await callSlack("users.channelSections.list"));
  if (!data.ok) throw new Error(data.error ?? "users.channelSections.list failed");
  const sections = extractChannelSections(data);
  return (sections ?? []).map((s) => ({
    channelIds: s.channelIds,
    id: s.id,
    name: s.name,
    sidebar: s.sidebar,
    type: s.type,
  }));
}
export async function createSection(name: string): Promise<{ id: string; name: string } | null> {
  const data = await callSlack("users.channelSections.create", {
    emoji: "",
    name,
    type: "standard",
  });
  if (!data.ok) return null;
  const created = data.channel_section ?? data;
  const id = created?.channel_section_id ?? created?.id;
  if (!id) return null;
  return { id, name: created?.name ?? name };
}
export async function renameSection(sectionId: string, name: string): Promise<boolean> {
  const data = await callSlack("users.channelSections.update", {
    channel_section_id: sectionId,
    name,
  });
  return !!data.ok;
}
export async function setSectionSidebar(
  sectionId: string,
  sidebar: "hid" | "active" | "all",
): Promise<boolean> {
  const data = await callSlack("users.channelSections.update", {
    channel_section_id: sectionId,
    sidebar,
  });
  return !!data.ok;
}
export async function deleteSection(sectionId: string): Promise<boolean> {
  const data = await callSlack("users.channelSections.delete", { channel_section_id: sectionId });
  return !!data.ok;
}
export async function reorderSection(
  sectionId: string,
  nextSectionId: string | null,
): Promise<boolean> {
  const data = await callSlack("users.channelSections.set", {
    channel_section_id: sectionId,
    ...(nextSectionId ? { next_channel_section_id: nextSectionId } : {}),
  });
  return !!data.ok;
}
export async function updateSectionChannels(
  sectionId: string,
  changes: { insertChannelIds?: string[]; removeChannelIds?: string[] },
): Promise<boolean> {
  const insert = changes.insertChannelIds?.length
    ? [{ channel_ids: changes.insertChannelIds, channel_section_id: sectionId }]
    : [];
  const remove = changes.removeChannelIds?.length
    ? [{ channel_ids: changes.removeChannelIds, channel_section_id: sectionId }]
    : [];
  const data = await callSlack("users.channelSections.channels.bulkUpdate", {
    _x_reason: "channel-sidebar-channel-drop",
    insert: JSON.stringify(insert),
    remove: JSON.stringify(remove),
  });
  return !!data.ok;
}
export async function setChannelNotifyAll(
  channelId: string,
  notifyAll: boolean,
  previous: { desktop?: string; mobile?: string } = {},
): Promise<void> {
  const value = notifyAll ? "everything" : "mentions_dms";
  const fallbackPrevious = notifyAll ? "mentions_dms" : "everything";
  const previousValues: PairedPreferenceValues = {
    desktop: previous.desktop ?? fallbackPrevious,
    mobile: previous.mobile ?? fallbackPrevious,
  };
  await writePairedPreference(value, previousValues, async (target, targetValue) => {
    const result = await callSlack("users.prefs.setNotifications", {
      channel_id: channelId,
      global: "false",
      name: target,
      value: targetValue,
    });
    return !!result.ok;
  });
}
export async function openDm(userId: string): Promise<string | null> {
  const data = await callSlack("conversations.open", { users: userId });
  if (!data.ok) return null;
  return data.channel?.id ?? null;
}
