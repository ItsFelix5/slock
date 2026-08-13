import { type AttachmentAction, runAttachmentAction } from "@slock/slack-api";
import { createSignal, For, onCleanup, Show } from "solid-js";
import type { BlockActionContext } from "./BlockKit";

export default function LegacyAttachmentActions(props: {
  actions: AttachmentAction[];
  attachmentId?: number;
  callbackId?: string;
  context?: BlockActionContext;
  isEphemeral: boolean;
}) {
  const [pendingName, setPendingName] = createSignal<string>();
  const [unsupported, setUnsupported] = createSignal<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const actionContext = () => {
    const ctx = props.context;
    if (
      props.attachmentId === undefined ||
      !props.callbackId ||
      !ctx?.botId ||
      !ctx.botUserId ||
      !ctx.channelId ||
      !ctx.messageTs
    ) {
      return;
    }
    return {
      attachmentId: props.attachmentId,
      botId: ctx.botId,
      botUserId: ctx.botUserId,
      callbackId: props.callbackId,
      channelId: ctx.channelId,
      messageTs: ctx.messageTs,
    };
  };
  const canDispatch = () => !!actionContext();
  const flashUnsupported = (name: string) => {
    clearTimeout(timer);
    setUnsupported(name);
    timer = setTimeout(() => setUnsupported(), 2000);
  };
  const click = (action: AttachmentAction) => {
    if (action.url || pendingName()) return;
    const ctx = actionContext();
    if (!ctx) {
      flashUnsupported(action.name);
      return;
    }
    setPendingName(action.name);
    runAttachmentAction({
      action,
      attachmentId: ctx.attachmentId,
      botId: ctx.botId,
      botUserId: ctx.botUserId,
      callbackId: ctx.callbackId,
      channelId: ctx.channelId,
      isEphemeral: props.isEphemeral,
      messageTs: ctx.messageTs,
    })
      .catch(() => {
        if (active) flashUnsupported(action.name);
      })
      .finally(() => {
        if (active) setPendingName();
      });
  };

  onCleanup(() => {
    active = false;
    clearTimeout(timer);
  });

  return (
    <div class="bk-actions attachment-actions">
      <For each={props.actions}>
        {(action) =>
          action.url ? (
            <a
              class={`bk-button bk-button--${action.style ?? "default"}`}
              href={action.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {action.text}
            </a>
          ) : (
            <button
              class={`bk-button bk-button--${action.style ?? "default"}`}
              disabled={pendingName() === action.name}
              onClick={() => click(action)}
              title={
                unsupported() === action.name || canDispatch()
                  ? undefined
                  : "This button needs its app to respond"
              }
              type="button"
            >
              <Show fallback={action.text} when={unsupported() === action.name}>
                Not supported here
              </Show>
            </button>
          )
        }
      </For>
    </div>
  );
}
