export type Axis = "row" | "col";
export type Edge = "top" | "right" | "bottom" | "left";

export interface TileLeaf<T> {
  type: "leaf";
  id: string;
  content: T;
}

export interface TileSplit<T> {
  type: "split";
  id: string;
  axis: Axis;
  sizes: number[];
  children: TileNode<T>[];
}

export type TileNode<T> = TileLeaf<T> | TileSplit<T>;

let nextId = 0;
export function createTileId(): string {
  nextId += 1;
  return `tile-${Date.now().toString(36)}-${nextId}`;
}

export function leaf<T>(content: T, id = createTileId()): TileLeaf<T> {
  return { type: "leaf", id, content };
}

function axisForEdge(edge: Edge): Axis {
  return edge === "left" || edge === "right" ? "row" : "col";
}

function isBefore(edge: Edge): boolean {
  return edge === "left" || edge === "top";
}

export function findLeaf<T>(tree: TileNode<T>, id: string): TileLeaf<T> | null {
  if (tree.type === "leaf") return tree.id === id ? tree : null;
  for (const child of tree.children) {
    const found = findLeaf(child, id);
    if (found) return found;
  }
  return null;
}

export function findLeafBy<T>(
  tree: TileNode<T>,
  predicate: (content: T) => boolean,
): TileLeaf<T> | null {
  if (tree.type === "leaf") return predicate(tree.content) ? tree : null;
  for (const child of tree.children) {
    const found = findLeafBy(child, predicate);
    if (found) return found;
  }
  return null;
}

export function listLeaves<T>(tree: TileNode<T>): TileLeaf<T>[] {
  if (tree.type === "leaf") return [tree];
  return tree.children.flatMap((child) => listLeaves(child));
}

function containsLeaf<T>(node: TileNode<T>, id: string): boolean {
  return findLeaf(node, id) !== null;
}

// New pane gets an even share (1/n); existing siblings shrink proportionally to make room.
function redistributeForInsert(sizes: number[], insertAt: number): number[] {
  const evenShare = 1 / (sizes.length + 1);
  const next = sizes.map((s) => s * (1 - evenShare));
  next.splice(insertAt, 0, evenShare);
  return next;
}

// Removed pane's share is redistributed proportionally among the remaining siblings.
function redistributeForRemove(sizes: number[], removeAt: number): number[] {
  const removed = sizes[removeAt] ?? 0;
  const rest = sizes.filter((_, i) => i !== removeAt);
  const total = rest.reduce((a, b) => a + b, 0);
  if (rest.length === 0) return rest;
  if (total <= 0) return rest.map(() => 1 / rest.length);
  return rest.map((s) => s + (s / total) * removed);
}

function insertLeaf<T>(
  tree: TileNode<T>,
  targetLeafId: string,
  edge: Edge,
  newLeaf: TileLeaf<T>,
): TileNode<T> {
  const axis = axisForEdge(edge);
  const before = isBefore(edge);

  function recurse(node: TileNode<T>): TileNode<T> {
    if (node.type === "leaf") {
      if (node.id !== targetLeafId) return node;
      const children = before ? [newLeaf, node] : [node, newLeaf];
      return { type: "split", id: createTileId(), axis, sizes: [0.5, 0.5], children };
    }
    const targetIndex = node.children.findIndex((c) => containsLeaf(c, targetLeafId));
    if (targetIndex === -1) return node;
    const targetChild = node.children[targetIndex];
    if (node.axis === axis && targetChild.type === "leaf" && targetChild.id === targetLeafId) {
      // Same-axis split: insert as a sibling instead of nesting a redundant split.
      const children = [...node.children];
      const insertAt = before ? targetIndex : targetIndex + 1;
      children.splice(insertAt, 0, newLeaf);
      return { ...node, children, sizes: redistributeForInsert(node.sizes, insertAt) };
    }
    const children = [...node.children];
    children[targetIndex] = recurse(targetChild);
    return { ...node, children };
  }

  return recurse(tree);
}

export function splitLeaf<T>(
  tree: TileNode<T>,
  targetLeafId: string,
  edge: Edge,
  content: T,
): TileNode<T> {
  return insertLeaf(tree, targetLeafId, edge, leaf(content));
}

// Returns null only when removing the sole remaining leaf in the whole tree —
// callers must guard against that case (a tiling layout can't go empty).
export function closeLeaf<T>(tree: TileNode<T>, leafId: string): TileNode<T> | null {
  if (tree.type === "leaf") return tree.id === leafId ? null : tree;

  function recurse(node: TileNode<T>): TileNode<T> {
    if (node.type === "leaf") return node;
    const index = node.children.findIndex(
      (c) => (c.type === "leaf" && c.id === leafId) || containsLeaf(c, leafId),
    );
    if (index === -1) return node;
    const child = node.children[index];
    if (child.type === "leaf" && child.id === leafId) {
      const children = node.children.filter((_, i) => i !== index);
      const sizes = redistributeForRemove(node.sizes, index);
      return children.length === 1 ? children[0] : { ...node, children, sizes };
    }
    const children = [...node.children];
    children[index] = recurse(child);
    return { ...node, children };
  }

  return recurse(tree);
}

export function moveLeaf<T>(
  tree: TileNode<T>,
  sourceLeafId: string,
  targetLeafId: string,
  edge: Edge,
): TileNode<T> {
  if (sourceLeafId === targetLeafId) return tree;
  const source = findLeaf(tree, sourceLeafId);
  if (!(source && findLeaf(tree, targetLeafId))) return tree;
  const withoutSource = closeLeaf(tree, sourceLeafId);
  if (!withoutSource) return tree;
  return insertLeaf(withoutSource, targetLeafId, edge, source);
}

export function replaceLeafContent<T>(tree: TileNode<T>, leafId: string, content: T): TileNode<T> {
  if (tree.type === "leaf") return tree.id === leafId ? { ...tree, content } : tree;
  return {
    ...tree,
    children: tree.children.map((child) =>
      containsLeaf(child, leafId) ? replaceLeafContent(child, leafId, content) : child,
    ),
  };
}

export function resizeSplit<T>(tree: TileNode<T>, splitId: string, sizes: number[]): TileNode<T> {
  if (tree.type === "leaf") return tree;
  if (tree.id === splitId) return { ...tree, sizes };
  return { ...tree, children: tree.children.map((child) => resizeSplit(child, splitId, sizes)) };
}
