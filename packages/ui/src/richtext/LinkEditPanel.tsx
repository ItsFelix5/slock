import { createSignal } from "solid-js";

export default function LinkEditPanel(props: {
  initialText: string;
  initialUrl: string;
  onSave: (data: { text: string; url: string }) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = createSignal(props.initialText);
  const [url, setUrl] = createSignal(props.initialUrl);

  const save = (e: Event) => {
    e.preventDefault();
    if (url().trim()) props.onSave({ text: text().trim() || url().trim(), url: url().trim() });
  };

  return (
    <form class="rt-link-panel" onSubmit={save}>
      <input onInput={(e) => setText(e.currentTarget.value)} placeholder="text" value={text()} />
      <input
        autofocus
        onInput={(e) => setUrl(e.currentTarget.value)}
        placeholder="https://..."
        value={url()}
      />
      <div class="rt-link-panel-actions">
        <button onClick={props.onRemove} type="button">
          remove
        </button>
        <button onClick={props.onCancel} type="button">
          cancel
        </button>
        <button type="submit">save</button>
      </div>
    </form>
  );
}
