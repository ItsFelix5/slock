import { useDebouncer } from "@slock/core/solid";
import type { ConfirmationDialog } from "@slock/types";
import { createSignal, onCleanup } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import { useBlockKitConfirm } from "../context";
import { containerOf, runBlockAction } from "./blockActions";

export function useBlockActionDispatch(context: () => BlockActionContext | undefined) {
  const confirmDialog = useBlockKitConfirm();
  const [inFlight, setInFlight] = createSignal(0);
  const pending = () => inFlight() > 0;
  const [unsupported, setUnsupported] = createSignal(false);
  const unflash = useDebouncer(() => setUnsupported(false), 2000);
  let active = true;

  onCleanup(() => {
    active = false;
  });

  const flashUnsupported = () => {
    setUnsupported(true);
    unflash.schedule();
  };

  const canDispatch = (actionId?: string) => !!(context()?.botId && actionId);

  const dispatch = async (
    action: Record<string, unknown> & { action_id?: string },
    confirm?: ConfirmationDialog,
    concurrent = false,
  ) => {
    if (pending() && !concurrent) return;
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
    setInFlight((n) => n + 1);
    try {
      await runBlockAction({
        action,
        botId: ctx.botId,
        botTeamId: ctx.botTeamId,
        container: containerOf(ctx),
        state: ctx.view?.state.snapshot(ctx.view.blocks()),
      });
    } catch {
      if (active) flashUnsupported();
    } finally {
      if (active) setInFlight((n) => n - 1);
    }
  };

  const record = (action: Record<string, unknown> & { action_id?: string; block_id?: string }) => {
    const { action_id, block_id, ...value } = action;
    if (action_id) context()?.view?.state.record(block_id, action_id, value);
  };

  return {
    canDispatch,
    dispatch,
    flashUnsupported,
    pending,
    record,
    unsupported,
  };
}
