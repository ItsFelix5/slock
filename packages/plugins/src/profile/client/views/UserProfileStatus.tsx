import { EmojiText } from "@slock/blockkit";
import { Icon, IconButton, Popover } from "@slock/ui";
import { createSignal, lazy, Show } from "solid-js";
import type { ProfileForm } from "./profileForm";
import "./UserProfileStatus.css";

const EmojiPicker = lazy(() => import("../../../emoji/client/api/EmojiPicker"));

interface UserProfileStatusProps {
  form: ProfileForm;
  isSelf: boolean;
  statusEmoji: string;
  statusText: string;
}

export default function UserProfileStatus(props: UserProfileStatusProps) {
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const hasStatus = () => !!(props.statusText || props.statusEmoji);
  const saving = () => props.form.isSavingStatus();

  return (
    <Show
      fallback={
        <Show when={hasStatus()}>
          <p class="user-profile-status flex-align-center">
            <Show when={props.statusEmoji}>{(emoji) => <EmojiText text={emoji()} />}</Show>
            <EmojiText text={props.statusText} />
          </p>
        </Show>
      }
      when={props.isSelf}
    >
      <div class="user-profile-status-edit flex-align-center">
        <Popover
          onClose={() => setEmojiOpen(false)}
          open={emojiOpen()}
          trigger={
            <button
              aria-label="Set status emoji"
              class="user-profile-status-emoji-btn btn-reset flex-center hover-hl"
              disabled={saving()}
              onClick={() => setEmojiOpen(!emojiOpen())}
              type="button"
            >
              <Show fallback={<Icon name="emoji" size={16} />} when={props.statusEmoji}>
                <EmojiText text={props.statusEmoji} />
              </Show>
            </button>
          }
        >
          <Show when={emojiOpen()}>
            <EmojiPicker
              onClose={() => setEmojiOpen(false)}
              onSelect={(name) => {
                props.form.setInput("statusEmoji", `:${name}:`);
                setEmojiOpen(false);
              }}
            />
          </Show>
        </Popover>
        <input
          aria-label="Status"
          class="user-profile-status-input busy"
          disabled={saving()}
          onBlur={() => void props.form.saveStatus()}
          onInput={(e) => props.form.setInput("statusText", e.currentTarget.value)}
          data-commit-on-enter
          placeholder="What's your status?"
          type="text"
          value={props.statusText}
        />
        <Show when={hasStatus()}>
          <IconButton
            class="user-profile-status-clear busy hover-hl"
            disabled={saving()}
            icon="close"
            iconSize={12}
            label="Clear status"
            onClick={() => void props.form.clearStatus()}
          />
        </Show>
      </div>
    </Show>
  );
}
