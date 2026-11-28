import { maybeService } from "@slock/core/solid";
import { copyMessageLink } from "@slock/plugins/message-links/client/api/messageLinks";
import type { SearchResult } from "@slock/types";
import { ContextMenu, MenuItem, type useContextMenu } from "@slock/ui";
import { Show } from "solid-js";

const later = maybeService("later");

export default function MessageRowMenu(props: {
  menu: ReturnType<typeof useContextMenu>;
  message: SearchResult;
  onSplit: () => void;
}) {
  const isSaved = () => !!later()?.isSavedForLater(props.message.channelId, props.message.ts);
  const savePending = () =>
    !!later()?.laterLoading() ||
    !!later()?.isSaveForLaterPending(props.message.channelId, props.message.ts);
  const run = (action: () => void) => () => {
    props.menu.close();
    action();
  };

  return (
    <ContextMenu
      onClose={props.menu.close}
      open={props.menu.isOpen()}
      x={props.menu.x()}
      y={props.menu.y()}
    >
      <MenuItem
        icon="link"
        onClick={run(() => {
          const { channelId, threadTs, ts } = props.message;
          void copyMessageLink(channelId, ts, threadTs);
        })}
      >
        Copy link
      </MenuItem>
      <MenuItem icon="move-to-split-view" onClick={run(() => props.onSplit())}>
        Open in split view
      </MenuItem>
      <Show when={later()}>
        {(store) => (
          <MenuItem
            disabled={savePending()}
            icon={isSaved() ? "bookmark-filled" : "bookmark"}
            onClick={run(() => {
              store().toggleSaveForLater(props.message.channelId, props.message.ts);
            })}
          >
            {isSaved() ? "Remove from Later" : "Save for later"}
          </MenuItem>
        )}
      </Show>
    </ContextMenu>
  );
}
