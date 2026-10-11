import { EmojiText } from "@slock/blockkit";
import { Popover } from "@slock/ui";
import { createSignal, For } from "solid-js";
import type { MessageEditedProps } from "../../../messages/client/api";
import { diffText } from "../textDiff";
import "./EditedDiff.css";
import { defined } from "@slock/core";

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

export default function EditedDiff(props: MessageEditedProps) {
  const [open, setOpen] = createSignal(false);
  const versions = () => [...(props.msg.editHistory ?? []), props.msg.text];
  const steps = () =>
    versions()
      .slice(1)
      .map((after, i) => ({ after, before: versions()[i] }));

  return (
    <>
      {" "}
      <Popover
        class="edited-popover"
        onClose={() => setOpen(false)}
        open={open()}
        trigger={
          <button
            class="btn-reset message-edited edited-button"
            onClick={() => setOpen(!open())}
            type="button"
          >
            (edited)
          </button>
        }
      >
        <div class="edit-diff-list">
          <For each={steps().toReversed()}>
            {(step) => <EditDiff after={defined(step.after)} before={defined(step.before)} />}
          </For>
        </div>
      </Popover>
    </>
  );
}
