export function cachedEntityForId(
  data: any,
  id: string,
  pluralKey: string,
  singularKey: string,
): any | undefined {
  const plural = data[pluralKey];
  if (plural?.[id]) return plural[id];
  if (Array.isArray(plural)) return plural.find((entity: any) => entity?.id === id);
  const results = data.results;
  if (results?.[id]) return results[id];
  if (Array.isArray(results)) return results.find((entity: any) => entity?.id === id);
  if (results && typeof results === "object") {
    return Object.values<any>(results).find((entity: any) => entity?.id === id);
  }
  const singular = data[singularKey];
  return singular?.id === id ? singular : undefined;
}
