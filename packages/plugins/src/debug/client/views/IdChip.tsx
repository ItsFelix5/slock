import { useBlockKitResolver } from "@slock/blockkit";
import { Show } from "solid-js";
import { entities, openDebug } from "../entities";
import "./DebugPane.css";

export default function IdChip(props: { entity: string; id: string }) {
  const resolver = useBlockKitResolver();
  const entity = () => entities[props.entity];
  const trigger = () => (
    <button
      aria-label={`Debug ${entity()?.label} ${props.id}`}
      class="debug-chip btn-reset flex-center"
      onClick={() => openDebug(props.entity, props.id)}
      type="button"
    >
      {entity()?.chip?.(props.id)}
    </button>
  );
  return (
    <Show fallback={trigger()} when={entity()?.wrap}>
      {(wrap) => resolver[wrap()]?.(props.id, trigger()) ?? trigger()}
    </Show>
  );
}
