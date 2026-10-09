import { IconButton } from "@slock/ui";
import { type JSX, Show } from "solid-js";
import { type AccessOption, accessLabel } from "./accessLevels";

export default function AccessRow(props: {
  children: JSX.Element;
  level: string;
  onLevel?: (level: string) => void;
  onRemove?: () => void;
  options: AccessOption[];
}) {
  return (
    <div class="file-detail-access-row">
      <div class="file-detail-access-subject">{props.children}</div>
      <Show
        fallback={
          <span class="file-detail-access-level text-dim">
            {accessLabel(props.options, props.level)}
          </span>
        }
        when={props.onLevel}
      >
        {(onLevel) => (
          <select
            class="file-detail-access-level text-field select-field"
            onChange={(event) => onLevel()(event.currentTarget.value)}
            value={props.level}
          >
            {props.options.map((option) => (
              <option value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
      </Show>
      <Show fallback={<span />} when={props.onRemove}>
        {(onRemove) => (
          <IconButton icon="close" iconSize={14} label="Remove" onClick={onRemove()} size="sm" />
        )}
      </Show>
    </div>
  );
}
