import type { CanvasNode } from "@slock/types";
import { Delta, type Op } from "@slock/ui/editor/quill";
import { longestIncreasing, sameNode } from "../../protocol/api";
import {
  COLUMNS_EMBED,
  type ColumnsEmbedValue,
  embedValue,
  isBlockEmbed,
  isColumnsValue,
  isTableValue,
  TABLE_EMBED,
  type TableEmbedValue,
} from "./canvasEmbedValues";
import type { LineEntry } from "./canvasLineIds";

interface MergeSide {
  entries: LineEntry[];
  ops: Op[];
}

interface Sides<Value> {
  base: Value;
  local: Value;
  remote: Value;
}

type Groups = Map<string, CanvasNode[]>;

function mapSides<From, To>(sides: Sides<From>, map: (value: From) => To): Sides<To> {
  return { base: map(sides.base), local: map(sides.local), remote: map(sides.remote) };
}

function groupNodes(entries: LineEntry[]): Groups {
  const groups: Groups = new Map();
  for (const { id, node } of entries) {
    const columns = node.frames.flatMap((frame) => (frame.kind === "columns" ? [frame.id] : []));
    for (const owner of [id, ...columns]) {
      const group = groups.get(owner);
      if (group) group.push(node);
      else groups.set(owner, [node]);
    }
  }
  return groups;
}

function sameNodes(a: CanvasNode[] = [], b: CanvasNode[] = []): boolean {
  return (
    a.length === b.length &&
    a.every((node, index) => {
      const other = b[index];
      return !!other && sameNode(node, other);
    })
  );
}

function blocksById(ops: Op[]): Map<string, Op[]> {
  const blocks = new Map<string, Op[]>();
  let line: Op[] = [];
  function finish(attributes: Op["attributes"]) {
    const id = typeof attributes?.sid === "string" ? attributes.sid : "";
    blocks.set(id, [...(blocks.get(id) ?? []), ...line]);
    line = [];
  }
  for (const op of ops) {
    if (typeof op.insert !== "string") {
      line.push(op);
      if (op.insert && isBlockEmbed(op.insert)) finish(op.attributes);
      continue;
    }
    op.insert.split("\n").forEach((text, index, parts) => {
      if (text) line.push({ ...op, insert: text });
      if (index === parts.length - 1) return;
      line.push({ ...op, insert: "\n" });
      finish(op.attributes);
    });
  }
  return blocks;
}

function withoutIds(ops: Op[]): Op[] {
  return ops.map((op) => {
    if (!op.attributes?.sid) return op;
    const kept = Object.entries(op.attributes).filter(([key]) => key !== "sid");
    return { ...op, attributes: Object.fromEntries(kept) };
  });
}

function rebase({ base, local, remote }: Sides<Op[]>): Op[] {
  const origin = new Delta(base);
  const mine = origin.diff(new Delta(local));
  const theirs = origin.diff(new Delta(remote));
  return new Delta(local).compose(mine.transform(theirs, true)).ops;
}

function mergeColumns(values: Sides<ColumnsEmbedValue>, groups: Sides<Groups>) {
  const { base, local, remote } = values;
  const source = local.columns.length === base.columns.length ? remote : local;
  const resized =
    local.weights.join() !== base.weights.join() && local.columns.length === source.columns.length;
  return {
    columns: source.columns.map((ops, index) => {
      const [before, mine, theirs] = [base, local, remote].map((value) => value.columns[index]);
      return before && mine && theirs
        ? mergeOps({ base: before, local: mine, remote: theirs }, groups)
        : ops;
    }),
    id: source.id,
    weights: resized ? local.weights : source.weights,
  };
}

function shape(table: TableEmbedValue): string {
  return JSON.stringify([table.columns.map(({ id }) => id), table.rows.map(({ id }) => id)]);
}

function mergeTable(values: Sides<TableEmbedValue>): TableEmbedValue {
  const { base, local } = values;
  const source = shape(local) === shape(base) ? values.remote : local;
  const cells = mapSides(
    values,
    (table) =>
      new Map(table.rows.flatMap((row) => row.cells.map((cell) => [cell.contentId, cell.ops]))),
  );
  const width = (table: TableEmbedValue, id: string) =>
    table.columns.find((column) => column.id === id)?.width;
  return {
    columns: source.columns.map((column) => {
      const mine = width(local, column.id);
      return mine !== undefined && mine !== width(base, column.id)
        ? { ...column, width: mine }
        : column;
    }),
    id: source.id,
    rows: source.rows.map((row) => ({
      cells: row.cells.map(({ contentId, ops }) => {
        const before = cells.base.get(contentId);
        const mine = cells.local.get(contentId);
        const theirs = cells.remote.get(contentId);
        const merged =
          before && mine && theirs
            ? rebase({ base: before, local: mine, remote: theirs })
            : (mine ?? theirs ?? ops);
        return { contentId, ops: merged };
      }),
      id: row.id,
    })),
  };
}

function mergeBlock(sides: Sides<Op[]>, groups: Sides<Groups>): Op[] {
  const [first] = sides.local;
  const embed = first && typeof first.insert !== "string" ? first.insert : undefined;
  if (!(embed && isBlockEmbed(embed))) return rebase(sides);
  const columns = mapSides(sides, (ops) => embedValue(ops[0]?.insert, COLUMNS_EMBED));
  const { base, local, remote } = columns;
  if (isColumnsValue(base) && isColumnsValue(local) && isColumnsValue(remote))
    return [
      {
        ...first,
        insert: { [COLUMNS_EMBED]: mergeColumns({ base, local, remote }, groups) },
      },
    ];
  const tables = mapSides(sides, (ops) => embedValue(ops[0]?.insert, TABLE_EMBED));
  if (isTableValue(tables.base) && isTableValue(tables.local) && isTableValue(tables.remote))
    return [
      {
        ...first,
        insert: {
          [TABLE_EMBED]: mergeTable({
            base: tables.base,
            local: tables.local,
            remote: tables.remote,
          }),
        },
      },
    ];
  return sides.local;
}

function mergedOrder(ids: Sides<string[]>, kept: Map<string, Op[]>): string[] {
  const rank = new Map(ids.base.map((id, index) => [id, index]));
  const stayed = longestIncreasing(
    ids.local.map((id) => rank.get(id) ?? null),
    (a, b) => a < b,
  );
  const order = ids.remote.filter((id) => kept.has(id));
  const placed = new Set(order);
  ids.local.forEach((id, index) => {
    if (!kept.has(id) || (placed.has(id) && stayed.has(index))) return;
    if (placed.has(id)) order.splice(order.indexOf(id), 1);
    const previous = ids.local.slice(0, index).findLast((candidate) => placed.has(candidate));
    order.splice(previous === undefined ? 0 : order.indexOf(previous) + 1, 0, id);
    placed.add(id);
  });
  return order;
}

function mergeOps(ops: Sides<Op[]>, groups: Sides<Groups>): Op[] {
  const { base, local, remote } = mapSides(ops, blocksById);
  const untouched = (side: "local" | "remote", id: string) =>
    sameNodes(groups.base.get(id), groups[side].get(id));
  const kept = new Map<string, Op[]>();
  for (const [id, mine] of local) {
    const theirs = remote.get(id);
    const before = base.get(id);
    if (!theirs) {
      if (!before) kept.set(id, mine);
      else if (!untouched("local", id)) kept.set(id, withoutIds(mine));
    } else if (untouched("remote", id) || sameNodes(groups.local.get(id), groups.remote.get(id)))
      kept.set(id, mine);
    else if (before && !untouched("local", id))
      kept.set(id, mergeBlock({ base: before, local: mine, remote: theirs }, groups));
    else kept.set(id, theirs);
  }
  for (const [id, theirs] of remote)
    if (!(local.has(id) || (base.has(id) && untouched("remote", id)))) kept.set(id, theirs);
  const ids = mapSides({ base, local, remote }, (blocks) => [...blocks.keys()]);
  return mergedOrder(ids, kept).flatMap((id) => kept.get(id) ?? []);
}

export function blockChanged(before: LineEntry[], after: LineEntry[], id: string): boolean {
  return !sameNodes(groupNodes(before).get(id), groupNodes(after).get(id));
}

export function mergeCanvasOps(sides: Sides<MergeSide>): Op[] {
  return mergeOps(
    mapSides(sides, (side) => side.ops),
    mapSides(sides, (side) => groupNodes(side.entries)),
  );
}
