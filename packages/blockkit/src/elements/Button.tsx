import type { ButtonElement } from "@slock/slack-api";
import { createSignal, Show } from "solid-js";
import BkText from "../BkText";

export default function Button(props: { el: ButtonElement }) {
  const [unsupported, setUnsupported] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onClick = () => {
    if (props.el.url) return;
    clearTimeout(timer);
    setUnsupported(true);
    timer = setTimeout(() => setUnsupported(false), 2000);
  };

  return props.el.url ? (
    <a
      class={`bk-button bk-button--${props.el.style ?? "default"}`}
      href={props.el.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <BkText text={props.el.text} />
    </a>
  ) : (
    <button
      type="button"
      class={`bk-button bk-button--${props.el.style ?? "default"}`}
      title={unsupported() ? undefined : "This button needs its app to respond"}
      onClick={onClick}
    >
      <Show when={unsupported()} fallback={<BkText text={props.el.text} />}>
        Not supported here
      </Show>
    </button>
  );
}
