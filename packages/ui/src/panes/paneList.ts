export interface Pane<T> {
  id: string;
  content: T;
  size: number;
}

function hasContentKind<AllContent extends { kind: string }, T extends AllContent>(
  pane: Pane<AllContent | null>,
  kinds: string[],
): pane is Pane<T> {
  return !!pane.content && kinds.includes(pane.content.kind);
}

export function narrowPaneContent<AllContent extends { kind: string }, T extends AllContent>(
  pane: Pane<AllContent | null>,
  kind: T["kind"] | T["kind"][],
): Pane<T> | undefined {
  const kinds: string[] = Array.isArray(kind) ? kind : [kind];
  return hasContentKind<AllContent, T>(pane, kinds) ? pane : undefined;
}

const MIN_FRACTION = 0.12;

export { MIN_FRACTION };
