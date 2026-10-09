import { createEffect, on } from "solid-js";
import { pageIdle } from "./pageIdle";

export function createRecencyEviction(options: {
  visible: () => string[];
  keepRecent: number;
  evict: (key: string) => void;
}) {
  let recent: string[] = [];
  createEffect(
    on([options.visible, pageIdle], ([visible, idle]) => {
      const keep = idle ? 0 : options.keepRecent;
      const visibleSet = new Set(visible);
      const hidden = recent.filter((key) => !visibleSet.has(key));
      const retained = hidden.slice(0, keep);
      for (const key of hidden.slice(keep)) options.evict(key);
      recent = [...visibleSet, ...retained];
    }),
  );
}
