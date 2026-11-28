import { pageIdle } from "@slock/ui";
import { type Accessor, createEffect } from "solid-js";

export function createRecencyEviction(options: {
  visible: () => string[];
  keepRecent: number;
  evict: (key: string) => void;
  idle?: Accessor<boolean>;
}) {
  const idle = options.idle ?? (() => pageIdle());
  let recent: string[] = [];
  createEffect(
    () => ({ visible: options.visible(), isIdle: idle() }),
    ({ visible, isIdle }) => {
      const plan = planRecencyEviction(recent, visible, isIdle ? 0 : options.keepRecent);
      for (const key of plan.evict) options.evict(key);
      ({ recent } = plan);
    },
  );
}

export function planRecencyEviction(
  recent: string[],
  visible: string[],
  keep: number,
): { evict: string[]; recent: string[] } {
  const visibleSet = new Set(visible);
  const hidden = recent.filter((key) => !visibleSet.has(key));
  return {
    evict: hidden.slice(keep),
    recent: [...visibleSet, ...hidden.slice(0, keep)],
  };
}
