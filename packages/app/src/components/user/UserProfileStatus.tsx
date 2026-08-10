import { EmojiText } from "@slock/blockkit";
import { Icon, Popover, Tooltip } from "@slock/ui";
import { createSignal, lazy, Show } from "solid-js";
import "./UserProfileStatus.css";

const EmojiPicker = lazy(() => import("../composer/popovers/EmojiPicker"));

interface UserProfileStatusProps {
  isSelf: () => boolean;
  statusText: () => string;
  setStatusText: (value: string) => void;
  statusEmoji: () => string;
  setStatusEmoji: (value: string) => void;
  savingStatus: () => boolean;
  saveStatus: () => Promise<void>;
  clearStatus: () => Promise<void>;
  blurOnEnter: (event: KeyboardEvent) => void;
}

export default function UserProfileStatus(props: UserProfileStatusProps) {
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const hasStatus = () => !!(props.statusText() || props.statusEmoji());

  return (
    <Show
      fallback={
        <Show when={hasStatus()}>
          <p class="user-profile-status flex-align-center">
            <Show when={props.statusEmoji()}>{(emoji) => <EmojiText text={emoji()} />}</Show>
            {props.statusText()}
          </p>
        </Show>
      }
      when={props.isSelf()}
    >
      <div class="user-profile-status-edit flex-align-center">
        <Popover
          onClose={() => setEmojiOpen(false)}
          open={emojiOpen()}
          trigger={
            <button
              aria-label="Set status emoji"
              class="user-profile-status-emoji-btn btn-reset flex-center"
              disabled={props.savingStatus()}
              onClick={() => setEmojiOpen(!emojiOpen())}
              type="button"
            >
              <Show fallback={<Icon name="emoji" size={16} />} when={props.statusEmoji()}>
                <EmojiText text={props.statusEmoji()} />
              </Show>
            </button>
          }
        >
          <Show when={emojiOpen()}>
            <EmojiPicker
              onClose={() => setEmojiOpen(false)}
              onSelect={(name) => {
                props.setStatusEmoji(`:${name}:`);
                setEmojiOpen(false);
              }}
            />
          </Show>
        </Popover>
        <input
          aria-label="Status"
          class="user-profile-status-input"
          disabled={props.savingStatus()}
          onBlur={props.saveStatus}
          onInput={(e) => props.setStatusText(e.currentTarget.value)}
          onKeyDown={props.blurOnEnter}
          placeholder="What's your status?"
          type="text"
          value={props.statusText()}
        />
        <Show when={hasStatus()}>
          <Tooltip content="Clear status">
            <button
              aria-label="Clear status"
              class="user-profile-status-clear btn-reset flex-center"
              disabled={props.savingStatus()}
              onClick={props.clearStatus}
              type="button"
            >
              <Icon name="close" size={12} />
            </button>
          </Tooltip>
        </Show>
      </div>
    </Show>
  );
}
