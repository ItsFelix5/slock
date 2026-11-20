import { type Accessor, createEffect } from "solid-js";
import { pageIdle } from "./pageIdle";

export function createRecencyEviction(options: {
  visible: () => string[];
  keepRecent: number;
  evict: (key: string) => void;
  idle?: Accessor<boolean>;
}) {
  const idle = options.idle ?? pageIdle;
  let recent: string[] = [];
  createEffect(
    () => ({ visible: options.visible(), isIdle: idle() }),
    ({ visible, isIdle }) => {
      const keep = isIdle ? 0 : options.keepRecent;
      const visibleSet = new Set(visible);
      const hidden = recent.filter((key) => !visibleSet.has(key));
      const retained = hidden.slice(0, keep);
      for (const key of hidden.slice(keep)) options.evict(key);
      recent = [...visibleSet, ...retained];
    },
  );
}
