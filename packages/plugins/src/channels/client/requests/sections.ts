import { fetchInitialData } from "@slock/plugins/slack/client/api/initialData";
import { parseChannelId, replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@slock/slack/client";
import type { BootstrapSection, ChannelId, ChannelSection, RawChannelSection } from "@slock/types";

export async function fetchSections(signal: AbortSignal): Promise<ChannelSection[]> {
  const initial = await fetchInitialData();
  if (initial.error?.sections) throw new Error(initial.error.sections);
  return initial.sections === undefined
    ? fetchFreshSections(signal)
    : mapInitialSections(initial.sections);
}

export async function fetchFreshSections(signal: AbortSignal): Promise<ChannelSection[]> {
  const data = await apiGet<{ channel_sections?: RawChannelSection[] }>("/api/sections", signal);
  if (!data.ok) throw replyError(data, "users.channelSections.list failed");
  return (extractChannelSections(data) ?? []).map((s) => ({
    channelIds: s.channelIds,
    id: s.id,
    name: s.name,
    sidebar: s.sidebar,
    type: normalizeSectionType(s.type),
  }));
}

export async function createSection(name: string): Promise<{ id: string; name: string }> {
  const data = await apiPost<{ channel_section: RawChannelSection }>("/api/sections", { name });
  if (!data.ok) throw replyError(data, "users.channelSections.create failed");
  const created = data.channel_section;
  const id = created.channel_section_id ?? created.id;
  if (!id) throw new Error("users.channelSections.create returned no id");
  return { id, name: created.name ?? name };
}

export async function renameSection(sectionId: string, name: string): Promise<void> {
  const data = await apiPatch(`/api/sections/${sectionId}`, { name });
  if (!data.ok) throw replyError(data, "users.channelSections.update failed");
}

export async function deleteSection(sectionId: string): Promise<void> {
  const data = await apiDelete(`/api/sections/${sectionId}`);
  if (!data.ok) throw replyError(data, "users.channelSections.delete failed");
}

export async function reorderSection(
  sectionId: string,
  nextSectionId: string | null,
): Promise<void> {
  const data = await apiPut(`/api/sections/${sectionId}/order`, {
    nextSectionId,
  });
  if (!data.ok) throw replyError(data, "users.channelSections.set failed");
}

export async function updateSectionChannels(
  sectionId: string,
  changes: { insertChannelIds?: string[]; removeChannelIds?: string[] },
): Promise<void> {
  const data = await apiPut(`/api/sections/${sectionId}/channels`, changes);
  if (!data.ok) throw replyError(data, "users.channelSections.channels.bulkUpdate failed");
}

function mapInitialSections(sections: Record<string, BootstrapSection>): ChannelSection[] {
  return Object.entries(sections).map(([id, section]) => ({
    channelIds: (section.channel_ids ?? []).map(parseChannelId),
    id,
    name: section.name ?? "Section",
    sidebar:
      section.filtering === "all" || section.filtering === "active" ? section.filtering : "hid",
    type: normalizeSectionType(section.type ?? "standard"),
  }));
}

function normalizeSectionType(type: string): string {
  return type === "user_group" ? "usergroup" : type;
}

interface ChannelSectionSummary {
  channelIds: ChannelId[];
  id: string;
  name: string;
  sidebar: "hid" | "active" | "all";
  type: string;
}

export function extractChannelSections(
  data: { channel_sections?: RawChannelSection[] } | undefined,
): ChannelSectionSummary[] | null {
  const raw = data?.channel_sections;
  if (!Array.isArray(raw)) return null;

  return raw
    .map((s) => ({
      channelIds: (s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? []).map(
        parseChannelId,
      ),
      id: s.channel_section_id ?? s.id ?? s.name,
      name: s.name ?? "Section",

      sidebar: s.sidebar === "all" || s.sidebar === "active" ? s.sidebar : ("hid" as const),
      type: s.type ?? "standard",
    }))
    .filter((s): s is ChannelSectionSummary => !!s.id);
}
