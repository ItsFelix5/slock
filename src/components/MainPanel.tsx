import { Switch, Match } from "solid-js";
import { nav } from "../store";
import ChannelHeader from "./ChannelHeader";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ActivityView from "./ActivityView";
import LaterView from "./LaterView";
import MessageSearchView from "./MessageSearchView";
import "./MainPanel.css";

export default function MainPanel() {
  return (
    <div class="main-panel">
      <Switch>
        <Match when={nav() === "activity"}>
          <ActivityView />
        </Match>
        <Match when={nav() === "later"}>
          <LaterView />
        </Match>
        <Match when={nav() === "search"}>
          <MessageSearchView />
        </Match>
        <Match when={nav() === "home"}>
          <ChannelHeader />
          <MessageList />
          <Composer />
        </Match>
      </Switch>
    </div>
  );
}
