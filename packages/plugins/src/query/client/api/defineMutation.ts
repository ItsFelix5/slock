import { service } from "@slock/core/solid";
import {
  createMutation,
  type Mutation,
  type MutationOptions,
  type ResourceHub,
} from "@slock/resource";
import { createSignal, runWithOwner } from "solid-js";

const query = service("query");

export function defineMutation<V, R = void>(definition: MutationOptions<V, R>): Mutation<V> {
  const bound = new WeakMap<ResourceHub, { changes: () => number; mutation: Mutation<V> }>();

  const bind = () => {
    const { hub } = query;
    const existing = bound.get(hub);
    if (existing) return existing;
    const mutation = createMutation(definition);
    const version = () => createSignal(0, { ownedWrite: true });
    const [changes, setChanges] = runWithOwner(null, version) ?? version();
    mutation.subscribe(() => setChanges((current) => current + 1));
    const created = { changes, mutation };
    bound.set(hub, created);
    return created;
  };

  return {
    pending: (key) => {
      const { changes, mutation } = bind();
      changes();
      return mutation.pending(key);
    },
    run: (variables, options) => bind().mutation.run(variables, options),
    subscribe: (listener) => bind().mutation.subscribe(listener),
  };
}
