import { Show } from "solid-js";
import CanvasPanel from "./components/channel/CanvasPanel";
import PinnedPanel from "./components/channel/PinnedPanel";
import MainPanel from "./components/layout/MainPanel";
import ToastStack from "./components/layout/Toast";
import ThreadPanel from "./components/messages/ThreadPanel";
import BrowseChannels from "./components/sidebar/BrowseChannels";
import Sidebar from "./components/sidebar/Sidebar";
import UserProfile from "./components/user/UserProfile";
import { bootstrap } from "./lib/store";

function App() {
  return (
    <Show when={!bootstrap.loading} fallback={<div class="app-status">Loading Slack…</div>}>
      <Show
        when={!bootstrap.error}
        fallback={<div class="app-status">Failed to load: {String(bootstrap.error)}</div>}
      >
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
      </Show>
    </Show>
  );
}

export default App;
