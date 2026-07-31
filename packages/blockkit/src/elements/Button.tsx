import { type ButtonElement, runBlockAction } from "@slock/slack-api";
import { createSignal, onCleanup, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";

export default function Button(props: {
  blockId?: string;
  context?: BlockActionContext;
  el: ButtonElement;
}) {
  const [unsupported, setUnsupported] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const canDispatch = () => !!(props.context?.botId && props.el.action_id);

  const flashUnsupported = () => {
    clearTimeout(timer);
    setUnsupported(true);
    timer = setTimeout(() => setUnsupported(false), 2000);
  };

  const onClick = () => {
    if (props.el.url || pending()) return;
    const ctx = props.context;
    if (!(ctx?.botId && props.el.action_id)) {
      flashUnsupported();
      return;
    }
    setPending(true);
    runBlockAction({
      actionId: props.el.action_id,
      blockId: props.blockId,
      botId: ctx.botId,
      buttonText: props.el.text.text,
      channelId: ctx.channelId,
      messageTs: ctx.messageTs,
      value: props.el.value,
    })
      .catch(() => {
        if (active) flashUnsupported();
      })
      .finally(() => {
        if (active) setPending(false);
      });
  };

  onCleanup(() => {
    active = false;
    clearTimeout(timer);
  });

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
      disabled={pending()}
      onClick={onClick}
      title={unsupported() || canDispatch() ? undefined : "This button needs its app to respond"}
      type="button"
    >
      <Show fallback={<BkText text={props.el.text} />} when={unsupported()}>
        Not supported here
      </Show>
    </button>
  );
}
