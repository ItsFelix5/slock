import { service } from "@slock/core/solid";
import { type Accessor, getOwner, type Owner, onSettled, runWithOwner } from "solid-js";
import type { ShortcutOptions } from "./shortcutRegistry";
import { useShortcut } from "./useShortcut";

export interface EscapeLayer {
  enabled: Accessor<boolean>;
  onClose: () => void;
  owner: Owner | null;
}

const ui = service("ui");

function closeAfterBlur(onClose: () => void, activeElement: { blur: () => void } | null) {
  activeElement?.blur();
  onClose();
}

function topLayer(): EscapeLayer | undefined {
  return ui.escapeLayers.findLast((layer) => runWithOwner(layer.owner, layer.enabled));
}

const CLOSE_SHORTCUT = {
  combo: { key: "Escape" },
  id: "general.close",
  label: "Close or cancel",
  scope: "general",
  group: "App",
} as const;

export function useCancelShortcut(handler: () => void, options: ShortcutOptions = {}) {
  useShortcut({
    ...CLOSE_SHORTCUT,
    ...options,
    handler,
    target: options.target ?? (() => true),
  });
}

export function useCloseShortcut() {
  useShortcut({
    ...CLOSE_SHORTCUT,
    allowInInputs: true,
    enabled: () => topLayer() !== undefined,
    handler: () => {
      const layer = topLayer();
      if (!layer) return;
      runWithOwner(layer.owner, () =>
        closeAfterBlur(
          layer.onClose,
          document.activeElement instanceof HTMLElement ? document.activeElement : null,
        ),
      );
    },
  });
}

export function useEscapeClose(onClose: () => void, enabled: Accessor<boolean> = () => true) {
  const owner = getOwner();
  onSettled(() => {
    const layer = ui.escapeLayers.push({ enabled, onClose, owner });
    return () => {
      ui.escapeLayers.pop(layer);
    };
  });
}
