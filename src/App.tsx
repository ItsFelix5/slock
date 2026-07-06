import { Show } from 'solid-js';
import IconRail from './components/IconRail';
import Sidebar from './components/Sidebar';
import MainPanel from './components/MainPanel';
import ThreadPanel from './components/ThreadPanel';
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
          <IconRail />
          <Sidebar />
          <MainPanel />
          <ThreadPanel />
        </div>
      </Show>
    </Show>
  );
}

export default App;
