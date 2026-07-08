import { Show } from "solid-js";
import "./Pronouns.css";

export default function Pronouns(props: { text: string | undefined }) {
  return (
    <Show when={props.text}>
      <span class="pronouns">({props.text})</span>
    </Show>
  );
}
