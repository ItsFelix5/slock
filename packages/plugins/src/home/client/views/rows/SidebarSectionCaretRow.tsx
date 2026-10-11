import { Icon, type IconName } from "@slock/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import "./SidebarSection.css";

export function SidebarSectionCaretRow(props: {
  badge?: JSX.Element;
  caretIcon?: IconName;
  caretSize?: number;
  label: string;
  labelAriaLabel?: string;
  onLabelClick?: () => void;
  onToggleOpen: () => void;
  open: boolean;
}) {
  return (
    <div class="sidebar-section-header-btn flex-align-center text-muted text-sm">
      <button
        aria-expanded={props.open}
        aria-label={`${props.open ? "Collapse" : "Expand"} ${props.label}`}
        class="sidebar-caret btn-reset icon-shift"
        onClick={props.onToggleOpen}
        type="button"
      >
        <Icon
          name={props.caretIcon ?? (props.open ? "caret-down-filled" : "caret-right-filled")}
          size={props.caretSize ?? 12}
        />
      </button>
      <Show fallback={<span>{props.label}</span>} when={props.onLabelClick}>
        {(onLabelClick) => (
          <button
            aria-label={props.labelAriaLabel}
            class="btn-reset text-muted text-sm"
            onClick={onLabelClick()}
            type="button"
          >
            {props.label}
          </button>
        )}
      </Show>
      {props.badge}
    </div>
  );
}
