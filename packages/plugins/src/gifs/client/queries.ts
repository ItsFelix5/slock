import { defineQuery } from "@slock/plugins/query/client/api";
import type { Gif } from "./store";
import { loadGifs } from "./tenor";

const STALE_MS = 5 * 60 * 1000;

export const gifsQuery = defineQuery<string, Gif[]>({
  load: (query, { signal }) => loadGifs(query, signal),
  maxAgeMs: STALE_MS,
  name: "gifs",
});
