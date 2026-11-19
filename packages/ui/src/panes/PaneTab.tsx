import { Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import Icon from "../media/Icon";
import ContextMenu from "../overlay/menu/ContextMenu";
import MenuItem from "../overlay/menu/MenuItem";
import { useContextMenu } from "../overlay/menu/useContextMenu";

export interface PaneTabProps {
  active: boolean;
  children: JSX.Element;
  hasOthers: boolean;
  onActivate: () => void;
  onClose?: () => void;
  onCloseOthers: () => void;
  tabRef: (el: HTMLButtonElement) => void;
}

export default function PaneTab(props: PaneTabProps) {
  const menu = useContextMenu();
  const run = (action: () => void) => () => {
    menu.close();
    action();
  };

  return (
    <div
      class="pane-tab-wrap flex-align-center"
      classList={{ active: props.active }}
      onAuxClick={(event) => {
        if (event.button !== 1 || !props.onClose) return;
        event.preventDefault();
        props.onClose();
      }}
      onContextMenu={menu.open}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
    >
      <button
        aria-selected={props.active}
        class="pane-tab truncate btn-reset"
        classList={{ active: props.active }}
        onClick={props.onActivate}
        ref={props.tabRef}
        role="tab"
        tabIndex={props.active ? 0 : -1}
        type="button"
      >
        {props.children}
      </button>
      <Show when={props.onClose}>
        {(onClose) => (
          <button
            aria-label="Close tab"
            class="pane-tab-close btn-reset flex-center hover-hl"
            onClick={(event) => {
              event.stopPropagation();
              onClose()();
            }}
            type="button"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </Show>
      <ContextMenu onClose={menu.close} open={menu.isOpen()} x={menu.x()} y={menu.y()}>
        <Show when={props.onClose}>
          {(onClose) => <MenuItem onClick={run(onClose())}>Close</MenuItem>}
        </Show>
        <Show when={props.onClose && props.hasOthers}>
          <MenuItem onClick={run(props.onCloseOthers)}>Close others</MenuItem>
        </Show>
      </ContextMenu>
    </div>
  );
}
