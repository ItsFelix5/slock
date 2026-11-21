import { service } from "@slock/core/solid";
import { createUsergroup } from "@slock/plugins/slack/client/api";
import { createSignal } from "solid-js";
import CreateDialog from "./CreateDialog";

const details = service("usergroup-details");

export default function CreateUsergroupDialog(props: { onClose: () => void }) {
  const [name, setName] = createSignal("");
  const trimmed = () => name().trim();

  return (
    <CreateDialog
      canSubmit={!!trimmed()}
      fallbackError="Couldn't create pinggroup."
      onClose={props.onClose}
      onSubmit={async () => {
        details.openUsergroupDetails(await createUsergroup(trimmed()));
      }}
      title="Create pinggroup"
    >
      <label class="create-field">
        <span class="create-label">Name</span>
        <input
          autofocus
          class="text-field"
          onInput={(event) => setName(event.currentTarget.value)}
          value={name()}
        />
      </label>
    </CreateDialog>
  );
}
