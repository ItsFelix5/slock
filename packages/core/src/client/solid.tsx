import type { JSX } from "@solidjs/web";
import {
  type Component,
  createComponent,
  createMemo,
  Errored,
  For,
  lazy,
  omit,
  untrack,
} from "solid-js";
import { getHost } from "../services";
import type { Points } from "../types";
import { usePoint } from "./reactive";

export { getHost, service, setHost } from "../services";
export { createFlags } from "./flags";
export { maybeService, solidReactive, usePoint } from "./reactive";
export { useDebouncer } from "./useDebouncer";

declare module "../types" {
  interface Points {
    root: Component;
  }
}

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
      {(item) => <Isolated name={`${props.point} item`}>{createComponent(item, rest)}</Isolated>}
    </For>
  );
}

export function Isolated(props: { children: JSX.Element; fallback?: JSX.Element; name: string }) {
  return (
    <Errored
      fallback={(error) => {
        console.error(`${untrack(() => props.name)} failed`, error());
        return props.fallback;
      }}
    >
      {props.children}
    </Errored>
  );
}

export function lazyChunk<Props extends object>(
  load: () => Promise<{ default: (props: Props) => JSX.Element }>,
) {
  return lazy(() => getHost().loadChunk(load));
}
