import type { AvatarUser } from "@slock/ui";
import { Avatar } from "@slock/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import "./ResultMessageCard.css";

export default function ResultMessageCard(props: {
  avatarUser: AvatarUser;
  context?: JSX.Element;
  name: JSX.Element;
  navRow?: boolean;
  onOpen: () => void;
  onSplit: () => void;
  snippet: JSX.Element;
  time?: string;
  trailing?: JSX.Element;
}) {
  return (
    <div class="result-message-card">
      <SplitNavigation onSplit={props.onSplit}>
        <button
          class="result-message-card-main btn-reset"
          data-nav-row={props.navRow ? true : undefined}
          onClick={props.onOpen}
          type="button"
        >
          <Avatar size="medium" user={props.avatarUser} />
          <div class="result-message-card-body">
            <div class="result-message-card-header">
              <span class="result-message-card-name">{props.name}</span>
              <Show when={props.context}>
                <span class="result-message-card-context">{props.context}</span>
              </Show>
              <Show when={props.time}>
                <span class="result-message-card-time">{props.time}</span>
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
