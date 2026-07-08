import { createSignal } from "solid-js";

export default function MessageEditForm(props: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = createSignal(props.initialText);

  const save = () => props.onSave(text());

  return (
    <div class="message-edit">
      <textarea
        class="message-edit-input"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            props.onCancel();
          }
        }}
        rows={1}
        autofocus
      />
      <div class="message-edit-actions">
        <button type="button" class="message-edit-save" onClick={save}>
          Save
        </button>
        <button type="button" class="message-edit-cancel" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
