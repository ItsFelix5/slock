import {
  type Accessor,
  type Component,
  createRoot,
  createSignal,
  ErrorBoundary,
  For,
  type JSX,
  splitProps,
  untrack,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Host } from "./host";
import type { Points, Reactive, Services } from "./types";

type ComponentPoint = {
  [P in keyof Points]: Points[P] extends (props: never) => JSX.Element ? P : never;
}[keyof Points];

type PropsOf<T> = T extends (props: infer Props) => JSX.Element ? Props : never;

export const solidReactive: Reactive = {
  scope: (fn) => createRoot((dispose) => ({ dispose, value: fn() })),
  signal: (initial) => {
    const [read, write] = createSignal(initial);
    return [read, (value) => write(() => value)];
  },
  untrack,
};

let current: Host | undefined;

export function setHost(host: Host) {
  current = host;
}

export function getHost(): Host {
  if (!current) throw new Error("host is not started");
  return current;
}

export function usePoint<P extends keyof Points>(point: P): Accessor<Points[P][]> {
  const host = getHost();
  return () => host.items(point);
}

export function useService<K extends keyof Services>(key: K): Services[K] {
  const service = untrack(() => getHost().service(key));
  if (service === undefined) throw new Error(`service ${String(key)} is missing`);
  return service;
}

export function useMaybeService<K extends keyof Services>(
  key: K,
): Accessor<Services[K] | undefined> {
  const host = getHost();
  return () => host.service(key);
}

export function Slot<P extends ComponentPoint>(props: { point: P } & PropsOf<Points[P]>) {
  const [, rest] = splitProps(props, ["point"]);
  const items = usePoint(props.point) as Accessor<Component<typeof rest>[]>;
  return (
    <For each={items()}>
      {(item) => (
        <ErrorBoundary
          fallback={(error) => {
            console.error(`${props.point} item failed`, error);
            return null;
          }}
        >
          <Dynamic component={item} {...rest} />
        </ErrorBoundary>
      )}
    </For>
  );
}

export function service<K extends keyof Services>(key: K): Services[K] {
  const resolve = () => {
    const found = getHost().service(key);
    if (found === undefined) throw new Error(`service ${String(key)} is missing`);
    return found;
  };
  return new Proxy(Object.create(null) as Services[K], {
    get: (_target, property) => Reflect.get(new Object(resolve()), property),
    has: (_target, property) => Reflect.has(new Object(resolve()), property),
  });
}

export function maybeService<K extends keyof Services>(key: K): Accessor<Services[K] | undefined> {
  return () => getHost().service(key);
}
