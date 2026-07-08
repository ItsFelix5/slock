import { Show } from "solid-js";
import { nav } from "../../lib/store";
import ChannelHeader from "../channel/ChannelHeader";
import Composer from "../composer/Composer";
import MessageList from "../messages/MessageList";
import MessageSearchView from "../search/MessageSearchView";
import "./MainPanel.css";

export default function MainPanel() {
  return (
    <div class="main-panel">
      <Show when={nav() !== "search"} fallback={<MessageSearchView />}>
        <ChannelHeader />
        <MessageList />
        <Composer />
      </Show>
    </div>
  );
}
