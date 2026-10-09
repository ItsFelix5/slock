import { EmojiText } from "@slock/blockkit";
import type { Message } from "@slock/types";
import { logDeletedMessages, Popover } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { diffText } from "../../../lib/textDiff";
import "./EditedLabel.css";

function EditDiff(props: { before: string; after: string }) {
  return (
    <div class="edit-diff">
      <For each={diffText(props.before, props.after)}>
        {(segment) => (
          <span class={`edit-diff-${segment.kind}`}>
            <EmojiText text={segment.text} />
          </span>
        )}
      </For>
    </div>
  );
}

export default function EditedLabel(props: { msg: Message }) {
  const [open, setOpen] = createSignal(false);
  const versions = () => [...(props.msg.editHistory ?? []), props.msg.text];
  const steps = () =>
    versions()
      .slice(1)
      .map((after, i) => ({ after, before: versions()[i] }));

  return (
    <Show
      fallback={<span class="message-edited"> (edited)</span>}
      when={logDeletedMessages() && props.msg.editHistory?.length}
    >
      {" "}
      <Popover
        class="edited-popover"
        onClose={() => setOpen(false)}
        open={open()}
        trigger={
          <button
            class="message-edited edited-button"
            onClick={() => setOpen(!open())}
            type="button"
          >
            (edited)
          </button>
        }
      >
        <div class="edit-diff-list">
          <For each={steps().toReversed()}>
            {(step) => <EditDiff after={step.after} before={step.before} />}
          </For>
        </div>
      </Popover>
    </Show>
  );
}
