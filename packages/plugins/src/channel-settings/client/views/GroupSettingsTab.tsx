import { service } from "@slock/core/solid";
import { normalizeChannelName } from "@slock/plugins/channels/client/api/channelName";
import type { ChannelId } from "@slock/types";
import { Button } from "@slock/ui";
import { createSignal } from "solid-js";
import "@slock/plugins/settings/client/api/SettingsForm.css";

const dialogs = service("shell.dialogs");
const channelDetails = service("channel-details");

export default function GroupSettingsTab(props: { channelId: ChannelId; onChanged: () => void }) {
  const [name, setName] = createSignal("");
  const converting = () => channelDetails.isConvertPending(props.channelId);

  async function convert() {
    const channelName = name();
    const { channelId, onChanged } = props;
    if (!channelName || converting()) return;
    const confirmed = await dialogs.confirm({
      confirmLabel: "Convert",
      danger: true,
      message: `Make this group chat the private channel #${channelName}? New members will see all messages. This can't be undone.`,
    });
    if (!confirmed) return;
    const ok = await channelDetails.convertToPrivateById(channelId, channelName);
    if (ok) onChanged();
  }

  return (
    <form
      class="settings-section"
      onSubmit={(event) => {
        event.preventDefault();
        void convert();
      }}
    >
      <label class="settings-section-title" for="group-chat-channel-name">
        Change to a private channel
      </label>
      <div class="settings-row flex-between gap-sm">
        <input
          class="text-field grow"
          id="group-chat-channel-name"
          onInput={(event) => setName(normalizeChannelName(event.currentTarget.value))}
          placeholder="Channel name"
          value={name()}
        />
        <Button disabled={!name() || converting()} type="submit" variant="danger">
          {converting() ? "Converting…" : "Convert"}
        </Button>
      </div>
    </form>
  );
}
