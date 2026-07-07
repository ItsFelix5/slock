import { Show } from 'solid-js';

export default function Pronouns(props: { text: string | undefined }) {
  return (
    <Show when={props.text}>
      <span class="pronouns">({props.text})</span>
    </Show>
  );
}
