import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { ToastStack } from "@slock/ui";
import { Show } from "solid-js";
import CanvasPanel from "./components/channel/CanvasPanel";
import PinnedPanel from "./components/channel/PinnedPanel";
import MainPanel from "./components/layout/MainPanel";
import ThreadPanel from "./components/messages/ThreadPanel";
import BrowseChannels from "./components/sidebar/BrowseChannels";
import Sidebar from "./components/sidebar/Sidebar";
import UserProfile from "./components/user/UserProfile";
import {
  bootstrap,
  channelById,
  channelDisplayName,
  currentUser,
  isChannelMember,
  openUserProfile,
  setActiveView,
  userById,
} from "./lib/store";

const blockKitResolver: BlockKitResolver = {
  resolveUser: (id) => {
    const user = userById(id);
    return user ? { name: user.name, isSelf: id === currentUser()?.id } : undefined;
  },
  resolveChannel: (id) => {
    const channel = channelById(id);
    return channel
      ? {
          name: channelDisplayName(channel),
          isPrivate: channel.private,
          isMember: isChannelMember(id),
        }
      : undefined;
  },
  onUserClick: openUserProfile,
  onChannelClick: (id) => setActiveView({ kind: "channel", id }),
};

function App() {
  return (
    <Show when={!bootstrap.loading} fallback={<div class="app-status">Loading Slack…</div>}>
      <Show
        when={!bootstrap.error}
        fallback={<div class="app-status">Failed to load: {String(bootstrap.error)}</div>}
      >
        <BlockKitResolverContext.Provider value={blockKitResolver}>
          <div class="app">
            <Sidebar />
            <MainPanel />
            <ThreadPanel />
            <UserProfile />
            <BrowseChannels />
            <PinnedPanel />
            <CanvasPanel />
            <ToastStack />
          </div>
        </BlockKitResolverContext.Provider>
      </Show>
    </Show>
  );
}

export default App;
