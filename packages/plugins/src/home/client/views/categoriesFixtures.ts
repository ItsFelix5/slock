import type { Channel } from "@slock/types";
import { buildCategories, type SectionData } from "./categories";

export type Section = SectionData;

export function channel(id: string, overrides: Partial<Channel> = {}): Channel {
  return {
    archived: false,
    id,
    name: id,
    private: false,
    topic: "",
    unread: false,
    ...overrides,
  };
}

export function section(
  id: string,
  type: string,
  channelIds: string[],
  overrides: Partial<Section> = {},
): Section {
  return { channelIds, id, name: id, sidebar: "all", type, ...overrides };
}

export type World = {
  channels?: Channel[];
  sections?: Section[];
  unreadsOnly?: boolean;
  unread?: string[];
  starred?: string[];
  left?: string[];
  open?: string[];
  muted?: string[];
  dms?: string[];
  hasDms?: boolean;
};

export function build(world: World) {
  const has = (list: string[] | undefined) => (id: string) => list?.includes(id) ?? false;
  return buildCategories({
    allChannels: world.channels ?? [],
    allDmIds: world.dms ?? [],
    hasDms: () => world.hasDms ?? true,
    isChannelLeft: has(world.left),
    isChannelMuted: has(world.muted),
    isChannelOpen: has(world.open),
    isChannelStarred: has(world.starred),
    isChannelUnread: has(world.unread),
    sections: () => world.sections,
    unreadsOnly: () => world.unreadsOnly ?? false,
  });
}

export const ids = (list: Channel[]) => list.map((c) => c.id);
