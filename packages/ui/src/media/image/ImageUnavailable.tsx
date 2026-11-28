import { Show } from "solid-js";
import Icon from "../Icon";
import "./ImageUnavailable.css";

export default function ImageUnavailable(props: { compact?: boolean }) {
  return (
    <span class="image-unavailable flex-col gap-sm fill">
      <Icon name="image-broken" size={22} />
      <Show when={!props.compact}>
        <span>Preview unavailable</span>
      </Show>
    </span>
  );
}
