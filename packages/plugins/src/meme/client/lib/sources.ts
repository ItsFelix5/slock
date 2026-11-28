import type { Message } from "@slock/types";
import { fileSrc, imageSrc } from "@slock/ui";
import type { MemeSource } from "../api";

function urlName(url: string): string {
  try {
    const last = new URL(url, "https://x.invalid").pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "image";
  } catch {
    return "image";
  }
}

export function memeSources(msg: Message): MemeSource[] {
  const files = (msg.files ?? []).flatMap((file): MemeSource[] =>
    file.isImage && !file.isDeleted && file.mimetype !== "image/svg+xml"
      ? [{ name: file.name, urls: [fileSrc(file.urlPrivate)] }]
      : [],
  );
  const seen = new Set<string>();
  const unfurled = (msg.attachments ?? []).flatMap((attachment): MemeSource[] => {
    const url = attachment.imageUrl;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ name: urlName(url), urls: [...new Set([fileSrc(url), imageSrc(url)])] }];
  });
  return [...files, ...unfurled];
}
