import { service } from "@slock/core/solid";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import { createEffect, createMemo } from "solid-js";
import { endDndSnooze, fetchDndStatus, setDndSnooze } from "./requests";

const env = service("env");
const feedback = service("feedback");

const dndStatus = defineQuery<null, number | null>({
  load: (_, { signal }) => fetchDndStatus(signal),
  name: "dndStatus",
});

const snoozing = defineMutation<{ failure: string; minutes?: number; until: number | null }>({
  mode: "single",
  onError: (error, { failure }) => {
    console.error(failure, error);
    feedback.error("dnd", failure);
  },
  onSuccess: (_, { until }) => dndStatus.set(null, until),
  optimistic: ({ until }, transaction) => transaction.apply(dndStatus, null, () => until),
  run: ({ minutes }) => (minutes === undefined ? endDndSnooze() : setDndSnooze(minutes)),
});

export function createDndSnooze() {
  const status = dndStatus.state(() => null);
  const dndSnoozedUntil = createMemo(() => status().data ?? null);

  createEffect(dndSnoozedUntil, (until) => {
    if (!until) return;
    const expire = () => dndStatus.set(null, null);
    const remaining = until - env.now();
    if (remaining <= 0) return expire();
    const timer = env.setTimeout(expire, remaining);
    return () => env.clearTimeout(timer);
  });

  return {
    applyDndSnoozeEvent: (snoozedUntil: number | null) => dndStatus.set(null, snoozedUntil),
    dndSnoozedUntil,
    endDnd: () => snoozing.run({ failure: "Failed to disable Do Not Disturb.", until: null }),
    hasDndStatusError: () => !!status().error,
    isDndActive: () => {
      const until = dndSnoozedUntil();
      return !!until && until > env.now();
    },
    isDndPending: () => snoozing.pending() || status().refreshing,
    retryDndStatus: () => dndStatus.refresh(null).catch(() => {}),
    snoozeDnd: (minutes: number) =>
      snoozing.run({
        failure: "Failed to enable Do Not Disturb.",
        minutes,
        until: env.now() + minutes * 60_000,
      }),
  };
}
