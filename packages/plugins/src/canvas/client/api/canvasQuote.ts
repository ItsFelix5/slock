import type { CanvasDocModel } from "../lib/canvasDelta";

const TAG_RE = /<[^>]*>/g;

export function isThreadAnnotation(annotationId: string, threadId: string): boolean {
  return annotationId.includes(threadId);
}

export function canvasHtmlLines(doc: CanvasDocModel | null | undefined): string[] {
  return (doc?.nodes ?? []).flatMap((node) => ("html" in node ? [node.html] : []));
}

export function annotationQuote(html: string[], threadId: string): string | undefined {
  const pattern = /<annotation id="([^"]*)">(.*?)<\/annotation>/g;
  const match = html
    .flatMap((line) => [...line.matchAll(pattern)])
    .find(([, id = ""]) => isThreadAnnotation(id, threadId));
  return match?.[2]?.replace(TAG_RE, "");
}
