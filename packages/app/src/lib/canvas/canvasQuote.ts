import type { CanvasDocModel } from "./canvasDelta";

const TAG_RE = /<[^>]*>/g;

export function isThreadAnnotation(annotationId: string, threadId: string): boolean {
  return annotationId.includes(threadId);
}

export function canvasHtmlLines(doc: CanvasDocModel | null | undefined): string[] {
  return (doc?.nodes ?? []).flatMap((node) => ("html" in node ? [node.html] : []));
}

export function annotationQuote(html: string[], threadId: string): string | undefined {
  const pattern = /<annotation id="([^"]*)">(.*?)<\/annotation>/g;
  for (const line of html) {
    for (const [, id = "", text = ""] of line.matchAll(pattern)) {
      if (isThreadAnnotation(id, threadId)) return text.replace(TAG_RE, "");
    }
  }
}
