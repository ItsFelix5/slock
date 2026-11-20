import type { JSX } from "@solidjs/web";
import { type Component, createComponent, createMemo, Errored, For, omit } from "solid-js";
import { usePoint } from "./solidHost";
import type { Points } from "./types";

export { getHost, maybeService, service, setHost, solidReactive, usePoint } from "./solidHost";

type ComponentPoint = {
  [P in keyof Points]: Points[P] extends (props: never) => JSX.Element ? P : never;
}[keyof Points];

type PropsOf<T> = T extends (props: infer Props) => JSX.Element ? Props : never;

function isComponent<Props extends Record<string, unknown>>(
  item: unknown,
): item is Component<Props> {
  return typeof item === "function";
}

export function Slot<P extends ComponentPoint>(props: { point: P } & PropsOf<Points[P]>) {
  const rest = omit(props, "point");
  const items = createMemo(() =>
    usePoint(props.point)().flatMap((item) => (isComponent<typeof rest>(item) ? [item] : [])),
  );
  return (
    <For each={items()}>
      {(item) => (
        <Errored
          fallback={(error) => {
            console.error(`${props.point} item failed`, error());
            return null;
          }}
        >
          {createComponent(item, rest)}
        </Errored>
      )}
    </For>
  );
}
