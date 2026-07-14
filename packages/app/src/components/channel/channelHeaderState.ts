import { ADDABLE_CHANNEL_TABS } from "../../lib/channelTabMeta";
import { channelDisplayName, store } from "../../lib/store";

export const channelTitle = () => {
  const view = store.viewState.activeView();
  if (!view) return "";
  if (view.kind === "channel")
    return channelDisplayName(store.channels.channelById(view.id), view.id);
  const dm = store.dms.dmById(view.id);
  return dm ? (store.users.userById(dm.userId)?.name ?? "") : "";
};
export const channelTopic = () => {
  const view = store.viewState.activeView();
  if (!view) return "";
  return view.kind === "channel"
    ? (store.channels.channelById(view.id)?.topic ?? "")
    : "Direct message";
};
export const isPrivateChannel = () => {
  const view = store.viewState.activeView();
  return view?.kind === "channel" && !!store.channels.channelById(view.id)?.private;
};
export const isChannelView = () => store.viewState.activeView()?.kind === "channel";
export const currentChannelId = () => {
  const view = store.viewState.activeView();
  return view?.kind === "channel" ? view.id : null;
};
export const isStarred = () => {
  const view = store.viewState.activeView();
  return view?.kind === "channel" && store.channels.isChannelStarred(view.id);
};
export const currentSectionId = () => {
  const view = store.viewState.activeView();
  if (!view) return null;
  return (
    store.channels
      .sections()
      ?.filter((s) => s.type === "standard")
      .find((s) => s.channelIds.includes(view.id))?.id ?? null
  );
};
export const availableChannelTabs = (id: string) =>
  ADDABLE_CHANNEL_TABS.filter((tab) => !store.channelTabs.tabsForChannel(id).includes(tab.type));
export const searchCurrentConversation = () => {
  const view = store.viewState.activeView();
  if (view)
    store.viewState.openMessageSearch("", view.kind === "channel" ? { inChannelId: view.id } : {});
};
export const openCurrentDmProfile = () => {
  const view = store.viewState.activeView();
  if (view?.kind === "dm") {
    const dm = store.dms.dmById(view.id);
    if (dm) store.users.openUserProfile(dm.userId);
  }
};
