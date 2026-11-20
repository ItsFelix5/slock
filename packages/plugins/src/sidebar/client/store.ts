import { createSignal, onSettled } from "solid-js";
import type { CycleTarget } from "./api";

type CycleSource = { order: number; targets: () => CycleTarget[] };

export function createSidebarStore(isHidden: (id: string) => boolean, focusSidebar: () => void) {
  const [nav, setNav] = createSignal("home");
  const [sources, setSources] = createSignal<CycleSource[]>([]);

  function setNavView(next: string) {
    setNav(next);
    if (!isHidden(next)) queueMicrotask(focusSidebar);
  }

  function provideCycle(order: number, targets: () => CycleTarget[]) {
    const source = { order, targets };
    onSettled(() => {
      setSources((current) => [...current, source].sort((a, b) => a.order - b.order));
      return () => setSources((current) => current.filter((item) => item !== source));
    });
  }

  const cycleTargets = () => sources().flatMap((source) => source.targets());

  function stepCycle(direction: -1 | 1, split: boolean) {
    const targets = cycleTargets();
    const current = Math.max(
      targets.findIndex((target) => target.active),
      0,
    );
    targets[(current + direction + targets.length) % targets.length]?.open(split);
  }

  return { cycleTargets, nav, provideCycle, setNavView, stepCycle };
}
