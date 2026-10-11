import type { Accessor } from "solid-js";
import type { TitleResolver } from "./api";

export function createTitles(resolvers: Accessor<TitleResolver[]>) {
  function resolve(id: string) {
    for (const resolver of resolvers()) {
      const title = resolver(id);
      if (title) return title;
    }
    return { name: id };
  }

  return {
    title: (id: string) => resolve(id).name,
    label: (id: string) => {
      const { name, prefix = "" } = resolve(id);
      return prefix + name;
    },
  };
}
