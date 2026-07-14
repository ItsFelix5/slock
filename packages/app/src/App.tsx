import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { TypingIndicator } from "@slock/ui";
import { createMemo, Show } from "solid-js";
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
import { channelDisplayName, store } from "./lib/store";

const blockKitResolver: BlockKitResolver = {
  onChannelClick: (id) => store.viewState.setActiveView({ id, kind: "channel" }),
  onUserClick: store.users.openUserProfile,
  resolveChannel: (id) => {
    const channel = store.channels.channelById(id);
    return channel
      ? {
          isMember: store.channels.isChannelMember(id),
          isPrivate: channel.private,
          name: channelDisplayName(channel),
        }
      : undefined;
  },
  resolveUser: (id) => {
    const user = store.users.userById(id);
    return user ? { isSelf: id === store.users.currentUser()?.id, name: user.name } : undefined;
  },
};

function App() {
  const unjoinedChannelId = () => {
    if (store.resources.bootstrap.loading) return;
    const v = store.viewState.activeView();
    return v?.kind === "channel" && !store.channels.isChannelMember(v.id) ? v.id : undefined;
  };

  const typingNames = createMemo(() => {
    const v = store.viewState.activeView();
    if (!v) return [];
    return store.typing.typingUsersInChannel(v.id).map((u) => u.name);
  });

  return (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      <div class="app">
        <Show when={store.resources.bootstrap.error}>
          <div class="app-bootstrap-error">
            Failed to load: {String(store.resources.bootstrap.error)}
          </div>
        </Show>
        <Sidebar />

        <div class="main-panel">
          <Show fallback={<MessageSearchView />} when={store.viewState.nav() !== "search"}>
            <ChannelHeader />
            <MessageList />
            <TypingIndicator names={typingNames()} />
            <Show fallback={<Composer />} when={unjoinedChannelId()}>
              {(channelId) => <JoinChannelBar channelId={channelId()} />}
            </Show>
          </Show>
        </div>
        <ThreadPanel />
        <UserProfile />
        <ChannelDetails />
        <PinnedPanel />
        <CanvasPanel />
      </div>
    </BlockKitResolverContext.Provider>
  );
}

export default App;
