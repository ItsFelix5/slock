import type { ChannelId } from "@slock/types";
import type { Accessor } from "solid-js";
import type { TitleResolver } from "./api";

export function createTitles(resolvers: Accessor<TitleResolver[]>) {
  function resolve(id: ChannelId) {
    for (const resolver of resolvers()) {
      const title = resolver(id);
      if (title) return title;
    }
    return { name: id };
  }

  return {
    title: (id: ChannelId) => resolve(id).name,
    label: (id: ChannelId) => {
      const { name, prefix = "" } = resolve(id);
      return prefix + name;
    },
  };
}
