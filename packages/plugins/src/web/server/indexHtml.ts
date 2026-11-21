export function preloadLinkHeader(hrefs: string[]): string | undefined {
  if (hrefs.length === 0) return;
  return hrefs.map((href) => `<${href}>; rel=preload; as=fetch; crossorigin`).join(", ");
}
