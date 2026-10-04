import { EmojiText } from "@slock/blockkit";
import { Avatar } from "@slock/ui";
import { createResource, For, Match, Show, Switch } from "solid-js";
import { fetchFileDetail } from "../../lib/api";
import { store } from "../../lib/store";
import MessageFiles from "../messages/parts/media/MessageFiles";
import { formatStartDate } from "./userProfileTime";

const URL_VALUE_RE = /^https?:\/\/\S+$/i;

function FileFieldValue(props: { id: string }) {
  const [detail] = createResource(() => props.id, fetchFileDetail);
  return (
    <Show fallback={<span class="user-profile-field-value">{props.id}</span>} when={detail()?.file}>
      {(file) => <MessageFiles files={[file()]} />}
    </Show>
  );
}

function UserFieldValue(props: { ids: string }) {
  return (
    <div class="user-profile-field-users flex-col">
      <For each={props.ids.split(",")}>
        {(id) => (
          <Show
            fallback={<span class="user-profile-field-value">{id}</span>}
            when={store.users.userById(id)}
          >
            {(user) => (
              <button
                class="user-profile-field-user btn-reset flex-align-center"
                onClick={() => store.users.openUserProfile(id)}
                type="button"
              >
                <Avatar size="small" user={user()} />
                <span class="truncate">{user().name}</span>
              </button>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}

export default function UserProfileFieldValue(props: {
  type?: string;
  value: string;
  alt?: string;
}) {
  const text = () => props.alt || props.value;
  return (
    <Switch
      fallback={
        <div class="user-profile-field-value">
          <EmojiText text={text()} />
        </div>
      }
    >
      <Match when={props.type === "user"}>
        <UserFieldValue ids={props.value} />
      </Match>
      <Match when={props.type === "file"}>
        <For each={props.value.split(",")}>{(id) => <FileFieldValue id={id} />}</For>
      </Match>
      <Match when={props.type === "date"}>
        <div class="user-profile-field-value">{formatStartDate(props.value) ?? props.value}</div>
      </Match>
      <Match when={URL_VALUE_RE.test(props.value)}>
        <a
          class="user-profile-field-value user-profile-field-link"
          href={props.value}
          rel="noopener noreferrer"
          target="_blank"
        >
          <EmojiText text={text()} />
        </a>
      </Match>
    </Switch>
  );
}
