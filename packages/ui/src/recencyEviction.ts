import { type Accessor, createEffect } from "solid-js";
import { pageIdle } from "./pageIdle";
import { planRecencyEviction } from "./recencyPlan";

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
