import { createLocalPref } from "../../slack/client/api/localPref";

export type Gif = { url: string; preview: string; media?: string };

export function createGifsStore() {
  const [favorites, persist] = createLocalPref<Gif[]>("gif-favorites", []);

  const isFavorite = (gif: Gif) => favorites().some((item) => item.url === gif.url);

  function toggleFavorite(gif: Gif) {
    persist(
      isFavorite(gif) ? favorites().filter((item) => item.url !== gif.url) : [gif, ...favorites()],
    );
  }

  return { favorites, isFavorite, toggleFavorite };
}
