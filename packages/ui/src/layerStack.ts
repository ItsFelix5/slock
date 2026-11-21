export function createLayerStack<T extends object>() {
  const layers: T[] = [];
  const top = () => layers.at(-1);
  return {
    findLast: (match: (layer: T) => boolean) => layers.findLast(match),
    isTop: (layer: T | undefined) => top() === layer,
    pop(layer: T) {
      const wasTop = top() === layer;
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      return { revealed: top(), wasTop };
    },
    push(layer: T): T {
      layers.push(layer);
      return layer;
    },
  };
}

export type LayerStack<T extends object> = ReturnType<typeof createLayerStack<T>>;
