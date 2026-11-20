import { EmojiText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { Avatar } from "@slock/ui";
import { Errored, For, Loading, Match, Show, Switch } from "solid-js";
import { useFileDetail } from "../../../files/client/api/fileDetailQuery";
import MessageFiles from "../../../message-media/client/api/MessageFiles";
import { formatStartDate } from "./userProfileTime";

const usersStore = service("users");

const URL_VALUE_RE = /^https?:\/\/\S+$/i;

function FileFieldValue(props: { id: string }) {
  const detail = useFileDetail(() => props.id);
  const fallback = () => <span class="user-profile-field-value">{props.id}</span>;
  return (
    <Errored fallback={fallback}>
      <Loading fallback={fallback()}>
        <Show fallback={fallback()} when={detail()?.file}>
          {(file) => <MessageFiles files={[file()]} />}
        </Show>
      </Loading>
    </Errored>
  );
}

function UserFieldValue(props: { ids: string }) {
  return (
    <div class="user-profile-field-users flex-col">
      <For each={props.ids.split(",")}>
        {(id) => (
          <Show
            fallback={<span class="user-profile-field-value">{id}</span>}
            when={usersStore.userById(id)}
          >
            {(user) => (
              <button
                class="user-profile-field-user btn-reset flex-align-center"
                onClick={() => usersStore.openUserProfile(id)}
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
