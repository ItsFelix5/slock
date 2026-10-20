import type { Gif } from "./store";

const TENOR_KEY = "3Z0688EVWYKH";
const TENOR_URL = "https://g.tenor.com/v1";
const LIMIT = 30;

type TenorResponse = {
  results: { itemurl: string; media: { gif: { url: string }; tinygif: { url: string } }[] }[];
};

async function fetchTenor(path: string, params: Record<string, string>): Promise<Gif[]> {
  const query = new URLSearchParams({
    ...params,
    key: TENOR_KEY,
    limit: String(LIMIT),
    media_filter: "minimal",
  });
  const response = await fetch(`${TENOR_URL}/${path}?${query}`);
  if (!response.ok) throw new Error(`Tenor returned ${response.status}`);
  const data: TenorResponse = await response.json();
  return data.results.flatMap((result) => {
    const [media] = result.media;
    return media ? [{ media: media.gif.url, preview: media.tinygif.url, url: result.itemurl }] : [];
  });
}

export function loadGifs(query: string): Promise<Gif[]> {
  return query ? fetchTenor("search", { q: query }) : fetchTenor("trending", {});
}
