export interface Pane<T> {
  id: string;
  content: T;
  size: number;
}

let nextId = 0;
export function createPaneId(): string {
  nextId += 1;
  return `pane-${Date.now().toString(36)}-${nextId}`;
}

const MIN_FRACTION = 0.12;

function redistributeForInsert(sizes: number[], insertAt: number, fraction: number): number[] {
  const f = Math.min(0.9, Math.max(0.1, fraction));
  const next = sizes.map((s) => s * (1 - f));
  next.splice(insertAt, 0, f);
  return next;
}

function redistributeForRemove(sizes: number[], removeAt: number): number[] {
  const removed = sizes[removeAt] ?? 0;
  const rest = sizes.filter((_, i) => i !== removeAt);
  const total = rest.reduce((a, b) => a + b, 0);
  if (rest.length === 0) return rest;
  if (total <= 0) return rest.map(() => 1 / rest.length);
  return rest.map((s) => s + (s / total) * removed);
}

export function insertPane<T>(
  panes: Pane<T>[],
  afterId: string | null,
  content: T,
  id: string = createPaneId(),
  fraction = 0.5,
): Pane<T>[] {
  const index = afterId ? panes.findIndex((p) => p.id === afterId) : -1;
  const insertAt = index === -1 ? panes.length : index + 1;
  const sizes = redistributeForInsert(
    panes.map((p) => p.size),
    insertAt,
    fraction,
  );
  const next = [...panes];
  next.splice(insertAt, 0, { id, content, size: 0 });
  return next.map((p, i) => ({ ...p, size: sizes[i] }));
}

export function closePane<T>(panes: Pane<T>[], id: string): Pane<T>[] {
  const index = panes.findIndex((p) => p.id === id);
  if (index === -1) return panes;
  const sizes = redistributeForRemove(
    panes.map((p) => p.size),
    index,
  );
  const next = panes.filter((_, i) => i !== index);
  return next.map((p, i) => ({ ...p, size: sizes[i] }));
}

export function replacePaneContent<T>(panes: Pane<T>[], id: string, content: T): Pane<T>[] {
  return panes.map((p) => (p.id === id ? { ...p, content } : p));
}

export function resizePanes<T>(panes: Pane<T>[], sizes: number[]): Pane<T>[] {
  return panes.map((p, i) => ({ ...p, size: sizes[i] ?? p.size }));
}

export function findPane<T>(panes: Pane<T>[], id: string): Pane<T> | undefined {
  return panes.find((p) => p.id === id);
}

export function findPaneByContent<T>(
  panes: Pane<T>[],
  predicate: (content: T) => boolean,
): Pane<T> | undefined {
  return panes.find((p) => predicate(p.content));
}

export { MIN_FRACTION };
