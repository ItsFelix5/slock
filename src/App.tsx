import { Show } from 'solid-js';
import Sidebar from './components/sidebar/Sidebar';
import MainPanel from './components/layout/MainPanel';
import ThreadPanel from './components/messages/ThreadPanel';
import UserProfile from './components/user/UserProfile';
import ToastStack from './components/layout/Toast';
import BrowseChannels from './components/sidebar/BrowseChannels';
import PinnedPanel from './components/channel/PinnedPanel';
import CanvasPanel from './components/channel/CanvasPanel';
import { bootstrap } from './lib/store';

function App() {
  return (
    <Show
      when={!bootstrap.loading}
      fallback={<div class="app-status">Loading Slack…</div>}
    >
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
