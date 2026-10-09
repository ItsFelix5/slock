import type { AvatarUser, useContextMenu } from "@slock/ui";
import { Avatar, NavRow, Tooltip } from "@slock/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import { ClickableAuthorName } from "../../user/AppBadge";
import { isRealUserId } from "./messageAuthor";
import "./ResultMessageCard.css";

export default function ResultMessageCard(props: {
  avatarUser: AvatarUser;
  context?: JSX.Element;
  ctxMenu?: ReturnType<typeof useContextMenu>;
  name: JSX.Element;
  onOpen: () => void;
  onSplit: () => void;
  snippet: JSX.Element;
  time?: string;
  timeTitle?: string;
  trailing?: JSX.Element;
  userId?: string;
}) {
  const profileUserId = () => (isRealUserId(props.userId) ? props.userId : undefined);
  return (
    <div class="result-message-card">
      <SplitNavigation onSplit={props.onSplit}>
        <NavRow
          class="result-message-card-main"
          onActivate={props.onOpen}
          onContextMenu={props.ctxMenu?.open}
          tabIndex={-1}
        >
          <Show fallback={<Avatar size="medium" user={props.avatarUser} />} when={profileUserId()}>
            {(userId) => (
              <ClickableAuthorName userId={userId()}>
                <Avatar size="medium" user={props.avatarUser} />
              </ClickableAuthorName>
            )}
          </Show>
          <div class="result-message-card-body grow">
            <div class="result-message-card-header">
              <span class="result-message-card-name">
                <Show fallback={props.name} when={profileUserId()}>
                  {(userId) => (
                    <ClickableAuthorName userId={userId()}>{props.name}</ClickableAuthorName>
                  )}
                </Show>
              </span>
              <Show when={props.context}>
                <span class="result-message-card-context flex-align-center">{props.context}</span>
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
        </NavRow>
      </SplitNavigation>
      <Show when={props.trailing}>
        <div class="result-message-card-trailing flex-align-center">{props.trailing}</div>
      </Show>
    </div>
  );
}
