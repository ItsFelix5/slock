import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { ToastStack } from "@slock/ui";
import { Show } from "solid-js";
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
    const v = activeView();
    return v?.kind === "channel" && !isChannelMember(v.id) ? v.id : undefined;
  };

  return (
    <Show when={!bootstrap.loading} fallback={<div class="app-status">Loading Slack…</div>}>
      <Show
        when={!bootstrap.error}
        fallback={<div class="app-status">Failed to load: {String(bootstrap.error)}</div>}
      >
        <BlockKitResolverContext.Provider value={blockKitResolver}>
          <div class="app">
            <Sidebar />

            <div class="main-panel">
              <Show when={nav() !== "search"} fallback={<MessageSearchView />}>
                <ChannelHeader />
                <MessageList />
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
      </Show>
    </Show>
  );
}

export default App;
