import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { dragSplitTarget, endDragSplit } from "../../lib/dragSplitTarget";
import "./SplitDropZone.css";
import { openConversationInSplit } from "./SplitNavigation";

export default function SplitDropZone() {
  return (
    <Show when={dragSplitTarget()}>
      {(target) => (
        <div
          class="split-drop-zone flex-col flex-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const { channelId, ts } = target();
            endDragSplit();
            openConversationInSplit(channelId, ts);
          }}
        >
          <Icon name="arrow-split" size={20} />
          <span>Drop to open as a split</span>
        </div>
      )}
    </Show>
  );
}
