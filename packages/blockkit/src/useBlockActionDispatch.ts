import { runBlockAction } from "@slock/types";
import { createSignal, onCleanup } from "solid-js";
import type { BlockActionContext } from "./BlockKit";

export function useBlockActionDispatch(context: () => BlockActionContext | undefined) {
  const [pending, setPending] = createSignal(false);
  const [unsupported, setUnsupported] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;

  onCleanup(() => {
    active = false;
    clearTimeout(timer);
  });

  const flashUnsupported = () => {
    clearTimeout(timer);
    setUnsupported(true);
    timer = setTimeout(() => setUnsupported(false), 2000);
  };

  const canDispatch = (actionId?: string) => !!(context()?.botId && actionId);

  const dispatch = (action: Record<string, unknown> & { action_id?: string }) => {
    if (pending()) return;
    const ctx = context();
    if (!(ctx?.botId && action.action_id)) {
      flashUnsupported();
      return;
    }
    setPending(true);
    return runBlockAction({
      action,
      botId: ctx.botId,
      channelId: ctx.channelId,
      messageTs: ctx.messageTs,
    })
      .catch(() => {
        if (active) flashUnsupported();
      })
      .finally(() => {
        if (active) setPending(false);
      });
  };

  return { canDispatch, dispatch, flashUnsupported, pending, unsupported };
}
