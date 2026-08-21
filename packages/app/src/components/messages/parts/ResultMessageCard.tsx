import type { AvatarUser, useContextMenu } from "@slock/ui";
import { Avatar, openContextMenuFromKeyboard, Tooltip } from "@slock/ui";
import type { JSX } from "solid-js";
import { createMemo, Show } from "solid-js";
import { isRealUserId } from "../../messages/parts/messageRenderState";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import ClickableAuthorName from "../../user/ClickableAuthorName";
import "./ResultMessageCard.css";

export default function ResultMessageCard(props: {
  avatarUser: AvatarUser;
  context?: JSX.Element;
  ctxMenu?: ReturnType<typeof useContextMenu>;
  name: JSX.Element;
  navRow?: boolean;
  onOpen: () => void;
  onSplit: () => void;
  rowKey?: string;
  snippet: JSX.Element;
  tabIndex?: number;
  time?: string;
  timeTitle?: string;
  trailing?: JSX.Element;
  userId?: string;
}) {
  const profileUserId = createMemo(() => (isRealUserId(props.userId) ? props.userId : undefined));
  return (
    <div class="result-message-card">
      <SplitNavigation onSplit={props.onSplit}>
        <button
          class="result-message-card-main btn-reset"
          data-nav-row={props.navRow ? true : undefined}
          data-row-key={props.rowKey}
          onClick={props.onOpen}
          onContextMenu={props.ctxMenu?.open}
          onKeyDown={(e) => props.ctxMenu && openContextMenuFromKeyboard(e, props.ctxMenu.openAt)}
          tabIndex={props.navRow ? props.tabIndex : undefined}
          type="button"
        >
          <Show fallback={<Avatar size="medium" user={props.avatarUser} />} when={profileUserId()}>
            {(userId) => (
              <ClickableAuthorName userId={userId()}>
                <Avatar size="medium" user={props.avatarUser} />
              </ClickableAuthorName>
            )}
          </Show>
          <div class="result-message-card-body">
            <div class="result-message-card-header">
              <span class="result-message-card-name">
                <Show fallback={props.name} when={profileUserId()}>
                  {(userId) => (
                    <ClickableAuthorName userId={userId()}>{props.name}</ClickableAuthorName>
                  )}
                </Show>
              </span>
              <Show when={props.context}>
                <span class="result-message-card-context">{props.context}</span>
              </Show>
              <Show when={props.time}>
                <Show
                  fallback={<span class="result-message-card-time">{props.time}</span>}
                  when={props.timeTitle}
                >
                  <Tooltip content={props.timeTitle}>
                    <span class="result-message-card-time">{props.time}</span>
                  </Tooltip>
                </Show>
              </Show>
            </div>
            <div class="result-message-card-snippet">{props.snippet}</div>
          </div>
        </button>
      </SplitNavigation>
      <Show when={props.trailing}>
        <div class="result-message-card-trailing">{props.trailing}</div>
      </Show>
    </div>
  );
}
