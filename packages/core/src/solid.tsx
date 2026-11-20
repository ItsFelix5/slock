import type { JSX } from "@solidjs/web";
import { type Accessor, type Component, createComponent, Errored, For, omit } from "solid-js";
import { usePoint } from "./solidHost";
import type { Points } from "./types";

export { getHost, maybeService, service, setHost, solidReactive, usePoint } from "./solidHost";

type ComponentPoint = {
  [P in keyof Points]: Points[P] extends (props: never) => JSX.Element ? P : never;
}[keyof Points];

type PropsOf<T> = T extends (props: infer Props) => JSX.Element ? Props : never;

export function Slot<P extends ComponentPoint>(props: { point: P } & PropsOf<Points[P]>) {
  const rest = omit(props, "point");
  const items = usePoint(props.point) as Accessor<Component<typeof rest>[]>;
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
