import { Show } from "solid-js";
import Avatar from "../avatar/Avatar";
import Icon from "../media/Icon";
import type { ComboboxOption } from "./Combobox";

export default function ComboboxLeading(props: { option: ComboboxOption }) {
  return (
    <>
      <Show when={props.option.avatar}>{(user) => <Avatar size="small" user={user()} />}</Show>
      <Show when={props.option.icon}>
        {(name) => <Icon class="suggestion-icon flex-center" name={name()} size={14} />}
      </Show>
    </>
  );
}
