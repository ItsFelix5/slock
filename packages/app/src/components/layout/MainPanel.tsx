import { Show } from "solid-js";
import { activeView, isChannelMember, nav } from "../../lib/store";
import ChannelHeader from "../channel/ChannelHeader";
import JoinChannelBar from "../channel/JoinChannelBar";
import Composer from "../composer/Composer";
import MessageList from "../messages/MessageList";
import MessageSearchView from "../search/MessageSearchView";
import "./MainPanel.css";

export default function MainPanel() {
  const unjoinedChannelId = () => {
    const v = activeView();
    return v?.kind === "channel" && !isChannelMember(v.id) ? v.id : undefined;
  };

  return (
    <div class="main-panel">
      <Show when={nav() !== "search"} fallback={<MessageSearchView />}>
        <ChannelHeader />
        <MessageList />
        <Show when={unjoinedChannelId()} fallback={<Composer />}>
          {(channelId) => <JoinChannelBar channelId={channelId()} />}
        </Show>
      </Show>
    </div>
  );
}
