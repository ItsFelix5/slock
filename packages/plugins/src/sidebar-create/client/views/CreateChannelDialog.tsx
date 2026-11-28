import { service } from "@slock/core/solid";
import { normalizeChannelName } from "@slock/plugins/channels/client/api/channelName";
import { createSignal } from "solid-js";
import { createChannel } from "../requests";
import CreateDialog from "./CreateDialog";

const channels = service("channels");
const conversations = service("conversations");

export default function CreateChannelDialog(props: { onClose: () => void }) {
  const [name, setName] = createSignal("");
  const [isPrivate, setIsPrivate] = createSignal(false);

  return (
    <CreateDialog
      canSubmit={!!name()}
      errors={{ name_taken: "A channel with this name already exists." }}
      fallbackError="Couldn't create channel."
      onClose={props.onClose}
      onSubmit={async () => {
        const channel = await createChannel(name(), isPrivate());
        channels.addJoinedChannel(channel);
        conversations.setActiveView({ id: channel.id, kind: "channel" });
      }}
      title="Create channel"
    >
      <label class="create-field">
        <span class="create-label">Name</span>
        <input
          autofocus
          class="text-field"
          onInput={(event) => setName(normalizeChannelName(event.currentTarget.value))}
          placeholder="new-channel"
          value={name()}
        />
      </label>
      <div class="create-field" role="group" aria-label="Visibility">
        <span class="create-label">Visibility</span>
        <div class="segmented-control create-visibility">
          <button
            class={["segmented-control-btn", { active: !isPrivate() }]}
            onClick={() => setIsPrivate(false)}
            type="button"
          >
            Public
          </button>
          <button
            class={["segmented-control-btn", { active: isPrivate() }]}
            onClick={() => setIsPrivate(true)}
            type="button"
          >
            Private
          </button>
        </div>
      </div>
    </CreateDialog>
  );
}
