import { EmojiText } from "@slock/blockkit";
import { Popover } from "@slock/ui";
import { createSignal, For, lazy, Show } from "solid-js";
import { EXPIRATION_OPTIONS } from "./userProfileOptions";

const EmojiPicker = lazy(() => import("../composer/popovers/EmojiPicker"));

interface UserProfileStatusProps {
  statusText: () => string;
  setStatusText: (value: string) => void;
  statusEmoji: () => string;
  setStatusEmoji: (value: string) => void;
  statusExpiration: () => number;
  setStatusExpiration: (value: number) => void;
  savingStatus: () => boolean;
  saveStatus: () => Promise<void>;
  clearStatus: () => Promise<void>;
}

export default function UserProfileStatus(props: UserProfileStatusProps) {
  const [emojiOpen, setEmojiOpen] = createSignal(false);

  return (
    <Show when={true}>
      <div class="user-profile-section">
        <h3 class="user-profile-section-title">Status</h3>
        <div class="settings-status-row flex-align-center">
          <Popover
            onClose={() => setEmojiOpen(false)}
            open={emojiOpen()}
            trigger={
              <button
                class="settings-status-emoji-btn btn-reset flex-center"
                disabled={props.savingStatus()}
                onClick={() => setEmojiOpen(!emojiOpen())}
                type="button"
              >
                <Show fallback="⛔" when={props.statusEmoji()}>
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
            class="settings-status-input"
            disabled={props.savingStatus()}
            onInput={(e) => props.setStatusText(e.currentTarget.value)}
            placeholder="What's your status?"
            type="text"
            value={props.statusText()}
          />
        </div>
        <select
          class="settings-status-expiration"
          disabled={props.savingStatus()}
          onChange={(e) => props.setStatusExpiration(Number(e.currentTarget.value))}
          value={props.statusExpiration()}
        >
          <For each={EXPIRATION_OPTIONS}>
            {(opt) => <option value={opt.seconds}>{opt.label}</option>}
          </For>
        </select>
        <div class="settings-status-actions flex-align-center">
          <button
            class="settings-status-save btn-reset"
            disabled={props.savingStatus()}
            onClick={props.saveStatus}
            type="button"
          >
            {props.savingStatus() ? "Saving…" : "Save status"}
          </button>
          <Show when={props.statusText() || props.statusEmoji()}>
            <button
              class="settings-status-clear btn-reset"
              disabled={props.savingStatus()}
              onClick={props.clearStatus}
              type="button"
            >
              Clear
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
