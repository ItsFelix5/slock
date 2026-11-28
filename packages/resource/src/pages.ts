export interface Page<Item, Cursor> {
  items: Item[];
  next?: Cursor;
  total?: number;
}

export interface Paged<Item, Cursor> extends Page<Item, Cursor> {
  pages: number;
}

export function appendPage<Item, Cursor>(
  current: Paged<Item, Cursor> | undefined,
  page: Page<Item, Cursor>,
  itemKey: (item: Item) => string,
): Paged<Item, Cursor> {
  const byKey = new Map<string, Item>();
  for (const item of current?.items ?? []) byKey.set(itemKey(item), item);
  for (const item of page.items) byKey.set(itemKey(item), item);
  return {
    items: [...byKey.values()],
    next: page.next,
    pages: (current?.pages ?? 0) + 1,
    total: page.total,
  };
}

export async function loadPages<Item, Cursor>(
  load: (cursor: Cursor | undefined) => Promise<Page<Item, Cursor>>,
  count: number,
  itemKey: (item: Item) => string,
): Promise<Paged<Item, Cursor>> {
  let loaded = appendPage(undefined, await load(undefined), itemKey);
  while (loaded.pages < count && loaded.next !== undefined)
    loaded = appendPage(loaded, await load(loaded.next), itemKey);
  return loaded;
}
