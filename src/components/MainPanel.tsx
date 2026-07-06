import ChannelHeader from './ChannelHeader';
import MessageList from './MessageList';
import Composer from './Composer';
import './MainPanel.css';

export default function MainPanel() {
  return (
    <div class="main-panel">
      <ChannelHeader />
      <MessageList />
      <Composer />
    </div>
  );
}
