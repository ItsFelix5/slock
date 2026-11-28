import { service } from "@slock/core/solid";
import type { View } from "@slock/plugins/conversations/client/api/types";

const channelsStore = service("channels");
const titles = service("titles");
const dmsStore = service("dms");

export function createChannelHeaderState(view: () => View | null) {
  const channelTitle = () => {
    const v = view();
    if (!v) return "";
    return titles.title(v.id);
  };
  const channelTopic = () => {
    const v = view();
    if (!v) return "";
    if (v.kind !== "channel") return dmsStore.dmById(v.id)?.topic || "Direct message";
    channelsStore.ensureChannelTopic(v.id);
    return channelsStore.channelById(v.id)?.topic ?? "";
  };
  const isPrivateChannel = () => {
    const v = view();
    return v?.kind === "channel" && !!channelsStore.channelById(v.id)?.private;
  };
  const isArchivedChannel = () => {
    const v = view();
    return v?.kind === "channel" && !!channelsStore.channelById(v.id)?.archived;
  };
  return { channelTitle, channelTopic, isArchivedChannel, isPrivateChannel };
}
