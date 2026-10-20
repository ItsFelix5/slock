import type { ConfirmationDialog } from "@slock/types";
import { confirmDialog } from "@slock/ui";
import { createSignal, onCleanup } from "solid-js";
import type { BlockActionContext } from "./BlockKit";
import { containerOf, runBlockAction } from "./blockActions";

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

  const dispatch = async (
    action: Record<string, unknown> & { action_id?: string },
    confirm?: ConfirmationDialog,
  ) => {
    if (pending()) return;
    const ctx = context();
    if (!(ctx?.botId && action.action_id)) {
      flashUnsupported();
      return;
    }
    if (
      confirm &&
      !(await confirmDialog({
        cancelLabel: confirm.deny.text,
        confirmLabel: confirm.confirm.text,
        danger: confirm.style === "danger",
        message: confirm.text.text,
        title: confirm.title.text,
      }))
    ) {
      return;
    }
    setPending(true);
    try {
      await runBlockAction({
        action,
        appId: ctx.appId,
        botId: ctx.botId,
        container: containerOf(ctx),
        state: ctx.view?.state.snapshot(ctx.view.blocks()),
      });
    } catch {
      if (active) flashUnsupported();
    } finally {
      if (active) setPending(false);
    }
  };

  const record = (action: Record<string, unknown> & { action_id?: string; block_id?: string }) => {
    const { action_id, block_id, ...value } = action;
    if (action_id) context()?.view?.state.record(block_id, action_id, value);
  };

  return { canDispatch, dispatch, flashUnsupported, pending, record, unsupported };
}
