import { Switch, Match } from 'solid-js';
import { nav } from '../../lib/store';
import ChannelHeader from '../channel/ChannelHeader';
import MessageList from '../messages/MessageList';
import Composer from '../composer/Composer';
import ActivityView from '../sidebar/ActivityView';
import LaterView from '../sidebar/LaterView';
import MessageSearchView from '../search/MessageSearchView';
import './MainPanel.css';

export default function MainPanel() {
  return (
    <div class="main-panel">
      <Switch>
        <Match when={nav() === 'activity'}>
          <ActivityView />
        </Match>
        <Match when={nav() === 'later'}>
          <LaterView />
        </Match>
        <Match when={nav() === 'search'}>
          <MessageSearchView />
        </Match>
        <Match when={nav() === 'home'}>
          <ChannelHeader />
          <MessageList />
          <Composer />
        </Match>
      </Switch>
    </div>
  );
}
