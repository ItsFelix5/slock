import { IconButton } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { type AccessOption, accessLabel } from "./accessLevels";

export default function AccessRow(props: {
  children: JSX.Element;
  class?: string;
  editLockedReason?: string;
  level: string;
  onLevel?: (level: string) => void;
  onRemove?: () => void;
  options: AccessOption[];
}) {
  const isLocked = (option: AccessOption) => !!props.editLockedReason && option.value !== "write";
  const renderOption = (option: AccessOption) => (
    <option value={option.value}>{option.label}</option>
  );

  return (
    <div class={`file-detail-access-row ${props.class ?? ""}`}>
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
            <For each={props.options.filter((option) => !isLocked(option))}>{renderOption}</For>
            <Show when={props.editLockedReason}>
              {(reason) => (
                <optgroup disabled label={reason()}>
                  <For each={props.options.filter(isLocked)}>{renderOption}</For>
                </optgroup>
              )}
            </Show>
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
