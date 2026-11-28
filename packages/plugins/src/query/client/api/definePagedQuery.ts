import { createFlags, service } from "@slock/core/solid";
import {
  appendPage,
  type FetchContext,
  loadPages,
  type Page,
  type Paged,
  stableKey,
} from "@slock/resource";
import { defineMutation } from "./defineMutation";
import { defineQuery, type Query, type QueryDefinition } from "./defineQuery";

interface PagedDefinition<Arg, Item, Cursor>
  extends Omit<QueryDefinition<Arg, Paged<Item, Cursor>>, "load" | "persist"> {
  itemKey: (item: Item) => string;
  load: (
    arg: Arg,
    cursor: Cursor | undefined,
    context: FetchContext,
  ) => Promise<Page<Item, Cursor>>;
}

export interface PagedQuery<Arg, Item, Cursor> extends Query<Arg, Paged<Item, Cursor>> {
  loadingMore(arg: Arg): boolean;
  more(arg: Arg): Promise<boolean>;
  moreFailed(arg: Arg): boolean;
}

const query = service("query");

export function definePagedQuery<Arg, Item, Cursor = string>({
  itemKey,
  load,
  ...definition
}: PagedDefinition<Arg, Item, Cursor>): PagedQuery<Arg, Item, Cursor> {
  const failures = new WeakMap<object, ReturnType<typeof createFlags<string>>>();
  const failed = () => {
    let flags = failures.get(query.hub);
    if (!flags) {
      flags = createFlags<string>();
      failures.set(query.hub, flags);
    }
    return flags;
  };

  const paged: Query<Arg, Paged<Item, Cursor>> = defineQuery({
    ...definition,
    load: async (arg: Arg, context: FetchContext) => {
      const loaded = await loadPages(
        (cursor: Cursor | undefined) => load(arg, cursor, context),
        paged.read(arg)?.pages ?? 1,
        itemKey,
      );
      failed().set(stableKey(arg), false);
      return loaded;
    },
  });

  const next = defineMutation<Arg>({
    key: stableKey,
    mode: "single",
    onError: (error, arg) => {
      console.error(`Failed to load more ${definition.name}`, error);
      failed().set(stableKey(arg), true);
    },
    run: async (arg) => {
      failed().set(stableKey(arg), false);
      const cursor = paged.read(arg)?.next;
      if (cursor === undefined) return void (await paged.ensure(arg));
      const page = await paged.request((context) => load(arg, cursor, context));
      if (!page) return;
      paged.modify(arg, (latest) =>
        latest.next === cursor ? appendPage(latest, page, itemKey) : latest,
      );
    },
  });

  return {
    ...paged,
    loadingMore: (arg) => next.pending(stableKey(arg)),
    more: (arg) => next.run(arg),
    moreFailed: (arg) => failed().has(stableKey(arg)),
  };
}
