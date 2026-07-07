import { Show } from 'solid-js';
import Sidebar from './components/Sidebar';
import MainPanel from './components/MainPanel';
import ThreadPanel from './components/ThreadPanel';
import UserProfile from './components/UserProfile';
import ToastStack from './components/Toast';
import BrowseChannels from './components/BrowseChannels';
import PinnedPanel from './components/PinnedPanel';
import CanvasPanel from './components/CanvasPanel';
import { bootstrap } from './store';

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
