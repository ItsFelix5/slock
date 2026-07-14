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
      rel="noopener noreferrer"
      target="_blank"
    >
      <BkText text={props.el.text} />
    </a>
  ) : (
    <button
      class={`bk-button bk-button--${props.el.style ?? "default"}`}
      onClick={onClick}
      title={unsupported() ? undefined : "This button needs its app to respond"}
      type="button"
    >
      <Show fallback={<BkText text={props.el.text} />} when={unsupported()}>
        Not supported here
      </Show>
    </button>
  );
}
