import { service } from "@slock/core/solid";
import { useShortcut } from "@slock/ui";

export function useCycleShortcuts() {
  const sidebar = service("sidebar");
  const enabled = () => sidebar.cycleTargets().length > 0;
  useShortcut({
    allowRepeat: true,
    combo: { key: "j" },
    enabled,
    group: "Channels and search",
    handler: (event) => sidebar.stepCycle(1, event.shiftKey),
    id: "sidebar.cycleNext",
    label: "Go to the next item",
    scope: "general",
    splitModifier: true,
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "k" },
    enabled,
    group: "Channels and search",
    handler: (event) => sidebar.stepCycle(-1, event.shiftKey),
    id: "sidebar.cyclePrev",
    label: "Go to the previous item",
    scope: "general",
    splitModifier: true,
  });
}
