import type { Accessor } from "solid-js";
import { type ListDirection, listNavigationIndex, type NavDirection } from "./form/listNavigation";
import { useCancelShortcut } from "./useEscapeClose";
import { inside, type ShortcutOptions, useShortcut } from "./useShortcut";

type Root = () => Element | null | undefined;
type Roots = Root | Root[];

const NAV_SHORTCUTS: Record<
  NavDirection,
  { id: string; key: string; label: string; repeat: boolean }
> = {
  down: { id: "nav.listNext", key: "ArrowDown", label: "Move to the next item", repeat: true },
  up: { id: "nav.listPrev", key: "ArrowUp", label: "Move to the previous item", repeat: true },
  right: { id: "nav.itemNext", key: "ArrowRight", label: "Move right", repeat: true },
  left: { id: "nav.itemPrev", key: "ArrowLeft", label: "Move left", repeat: true },
  start: { id: "nav.listHome", key: "Home", label: "Jump to the first item", repeat: false },
  end: { id: "nav.listEnd", key: "End", label: "Jump to the last item", repeat: false },
};

const LIST_DIRECTIONS: readonly ListDirection[] = ["down", "up", "start", "end"];
const LIST_DIRECTIONS_WITHOUT_EDGES: readonly ListDirection[] = ["down", "up"];
const GRID_DIRECTIONS: readonly NavDirection[] = ["up", "down", "left", "right", "start", "end"];
const SLIDER_DIRECTIONS: readonly NavDirection[] = ["left", "right", "start", "end"];

export const CONFIRM_SHORTCUT = {
  combo: { key: "Enter" },
  id: "general.confirm",
  label: "Confirm the focused field or item",
  group: "App",
  scope: "general",
} as const;

function targetOf(root: Roots | undefined): ShortcutOptions["target"] {
  if (!root) return;
  return inside(...(Array.isArray(root) ? root : [root]));
}

export function useConfirmShortcut(
  handler: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {},
) {
  useShortcut({ ...CONFIRM_SHORTCUT, ...options, handler });
}

export function useFieldCommitShortcut() {
  useConfirmShortcut(
    (event) => {
      if (event.target instanceof HTMLElement) event.target.blur();
    },
    { target: (element) => element.matches("[data-commit-on-enter]") },
  );
}

export function useEditShortcuts(options: {
  cancel?: () => void;
  commit?: () => void;
  enabled?: Accessor<boolean>;
  root: Root;
}) {
  const shared = { enabled: options.enabled, target: inside(options.root) };
  if (options.commit) useConfirmShortcut(options.commit, shared);
  if (options.cancel) useCancelShortcut(options.cancel, shared);
}

interface NavOptions<D extends NavDirection> {
  allowInInputs?: boolean;
  directions: readonly D[];
  enabled?: Accessor<boolean>;
  manual?: boolean;
  move: (direction: D, event: KeyboardEvent) => void;
  passthrough?: boolean;
  root?: Roots;
  splitModifier?: boolean;
}

export function useNavigationShortcuts<D extends NavDirection>(options: NavOptions<D>) {
  const target = targetOf(options.root);
  for (const direction of options.directions) {
    const { id, key, label, repeat } = NAV_SHORTCUTS[direction];
    useShortcut({
      allowInInputs: options.allowInInputs,
      allowRepeat: repeat,
      combo: { key },
      enabled: options.enabled,
      handler: (event) => options.move(direction, event),
      id,
      label,
      manual: options.manual,
      passthrough: options.passthrough,
      group: "Lists",
      scope: "lists",
      splitModifier: options.splitModifier,
      target,
    });
  }
}

export function useListShortcuts(options: {
  allowInInputs?: boolean;
  edges?: boolean;
  enabled?: Accessor<boolean>;
  manual?: boolean;
  move: (direction: ListDirection) => void;
  root?: Roots;
  submit?: () => void;
}) {
  useNavigationShortcuts({
    allowInInputs: options.allowInInputs,
    enabled: options.enabled,
    directions: options.edges === false ? LIST_DIRECTIONS_WITHOUT_EDGES : LIST_DIRECTIONS,
    manual: options.manual,
    move: options.move,
    root: options.root,
  });
  if (options.submit) {
    useConfirmShortcut(options.submit, {
      allowInInputs: options.allowInInputs,
      enabled: options.enabled,
      manual: options.manual,
      target: targetOf(options.root),
    });
  }
}

export function useGridShortcuts(options: {
  move: (direction: NavDirection) => void;
  root: Root;
  submit?: () => void;
}) {
  useNavigationShortcuts({ directions: GRID_DIRECTIONS, move: options.move, root: options.root });
  if (options.submit) useConfirmShortcut(options.submit, { target: targetOf(options.root) });
}

export function useTabStripShortcuts<T>(options: {
  activate: (item: T, index: number) => void;
  items: () => T[];
  orientation?: "horizontal" | "vertical";
  root: Root;
  selector?: string;
}) {
  const vertical = options.orientation === "vertical";
  useNavigationShortcuts({
    directions: vertical ? ["down", "up"] : ["right", "left"],
    move: (direction) => {
      const items = options.items();
      const tabs = [
        ...(options.root()?.querySelectorAll(options.selector ?? '[role="tab"]') ?? []),
      ];
      const { activeElement } = document;
      const current = activeElement ? tabs.indexOf(activeElement) : -1;
      if (current < 0) return;
      const forward = direction === "down" || direction === "right";
      const next = listNavigationIndex(forward ? "down" : "up", current, items.length, {
        wrap: true,
      });
      if (next !== undefined) options.activate(items[next], next);
    },
    root: options.root,
  });
}

export function useAdjustShortcuts(options: {
  edge: (end: "end" | "start") => void;
  enabled?: Accessor<boolean>;
  root: Root;
  step: (direction: -1 | 1, large: boolean) => void;
}) {
  useNavigationShortcuts({
    enabled: options.enabled,
    directions: SLIDER_DIRECTIONS,
    move: (direction, event) => {
      if (direction === "start") options.edge("start");
      else if (direction === "end") options.edge("end");
      else options.step(direction === "right" ? 1 : -1, event.shiftKey);
    },
    root: options.root,
    splitModifier: true,
  });
}

export function useSeekShortcuts(options: {
  currentTime: () => number;
  duration: () => number;
  root: Root;
  seekTo: (ratio: number) => void;
}) {
  useAdjustShortcuts({
    edge: (end) => options.seekTo(end === "start" ? 0 : 1),
    root: options.root,
    step: (direction) =>
      options.seekTo((options.currentTime() + direction * 5) / options.duration()),
  });
}
