import { ADDABLE_CHANNEL_TABS } from "../../lib/channelTabMeta";
import {
  closeFilesLinksPanel,
  filesLinksChannelId,
  openFilesLinksPanel,
} from "../../lib/filesLinksPanel";
import { channelDisplayName, dmDisplayName, store } from "../../lib/store";
import type { View } from "../../lib/store/slices/types";

export function createChannelHeaderState(view: () => View | null) {
  const channelTitle = () => {
    const v = view();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(store.channels.channelById(v.id), v.id);
    return dmDisplayName(store.dms.dmById(v.id), store.users.userById);
  };
  const channelTopic = () => {
    const v = view();
    if (!v) return "";
    if (v.kind !== "channel") return "Direct message";
    store.channels.ensureChannelTopic(v.id);
    return store.channels.channelById(v.id)?.topic ?? "";
  };
  const channelMemberCount = () => {
    const v = view();
    if (v?.kind !== "channel") return;
    store.channels.ensureChannelTopic(v.id);
    return store.channels.channelById(v.id)?.memberCount;
  };
  const isPrivateChannel = () => {
    const v = view();
    return v?.kind === "channel" && !!store.channels.channelById(v.id)?.private;
  };
  const isArchivedChannel = () => {
    const v = view();
    return v?.kind === "channel" && !!store.channels.channelById(v.id)?.archived;
  };
  const isChannelView = () => view()?.kind === "channel";
  const isStarred = () => {
    const v = view();
    return v?.kind === "channel" && store.channels.isChannelStarred(v.id);
  };
  const currentSectionId = () => {
    const v = view();
    if (!v) return null;
    return (
      store.channels
        .sections()
        ?.filter((s) => s.type === "standard")
        .find((s) => s.channelIds.includes(v.id))?.id ?? null
    );
  };
  const availableChannelTabs = (id: string) =>
    ADDABLE_CHANNEL_TABS.filter((tab) => !store.channelTabs.tabsForChannel(id).includes(tab.type));
  const filesLinksOpen = () => {
    const v = view();
    return !!v && filesLinksChannelId() === v.id;
  };
  const searchCurrentConversation = () => {
    const v = view();
    if (!v) return;
    if (filesLinksChannelId() === v.id) closeFilesLinksPanel();
    else openFilesLinksPanel(v.id);
  };
  const openCurrentDmProfile = () => {
    const v = view();
    if (v?.kind === "dm") {
      const userId = store.dms.dmById(v.id)?.userId;
      if (userId) store.users.openUserProfile(userId);
    }
  };
  return {
    availableChannelTabs,
    channelMemberCount,
    channelTitle,
    channelTopic,
    currentSectionId,
    filesLinksOpen,
    isArchivedChannel,
    isChannelView,
    isPrivateChannel,
    isStarred,
    openCurrentDmProfile,
    searchCurrentConversation,
  };
}
