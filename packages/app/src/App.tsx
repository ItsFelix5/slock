import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { showToast, ToastStack, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, Show } from "solid-js";
import CanvasPanel from "./components/channel/CanvasPanel";
import ChannelHeader from "./components/channel/ChannelHeader";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import JoinChannelBar from "./components/channel/JoinChannelBar";
import PinnedPanel from "./components/channel/PinnedPanel";
import Composer from "./components/composer/Composer";
import MessageList from "./components/messages/MessageList";
import ThreadPanel from "./components/messages/ThreadPanel";
import MessageSearchView from "./components/search/MessageSearchView";
import Sidebar from "./components/sidebar/Sidebar";
import UserProfile from "./components/user/UserProfile";
import {
  activeView,
  bootstrap,
  channelById,
  channelDisplayName,
  currentUser,
  isChannelMember,
  nav,
  openUserProfile,
  setActiveView,
  typingUsersInChannel,
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
  const unjoinedChannelId = () => {
    if (bootstrap.loading) return undefined;
    const v = activeView();
    return v?.kind === "channel" && !isChannelMember(v.id) ? v.id : undefined;
  };

  const typingNames = createMemo(() => {
    const v = activeView();
    if (!v) return [];
    return typingUsersInChannel(v.id).map((u) => u.name);
  });

  // The shell renders immediately on every other piece of state (channels, DMs,
  // current user) already falling back to empty/undefined — no reason to block
  // the whole app behind one resource when each part can show its own skeleton
  // and fill in as bootstrap resolves.
  createEffect(() => {
    if (bootstrap.error) showToast(`Failed to load: ${String(bootstrap.error)}`, 5000);
  });

  return (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      <div class="app">
        <Sidebar />

        <div class="main-panel">
          <Show when={nav() !== "search"} fallback={<MessageSearchView />}>
            <ChannelHeader />
            <MessageList />
            <TypingIndicator names={typingNames()} />
            <Show when={unjoinedChannelId()} fallback={<Composer />}>
              {(channelId) => <JoinChannelBar channelId={channelId()} />}
            </Show>
          </Show>
        </div>
        <ThreadPanel />
        <UserProfile />
        <ChannelDetails />
        <PinnedPanel />
        <CanvasPanel />
        <ToastStack />
      </div>
    </BlockKitResolverContext.Provider>
  );
}

export default App;
