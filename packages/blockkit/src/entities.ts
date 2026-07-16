const HTML_ENTITY_RE = /&(amp|lt|gt|quot|#39|#x27);/gi;

const HTML_ENTITIES: Record<string, string> = {
  "#39": "'",
  "#x27": "'",
  amp: "&",
  gt: ">",
  lt: "<",
  quot: '"',
};

export function decodeTextEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (_, entity: string) => HTML_ENTITIES[entity.toLowerCase()]);
}
