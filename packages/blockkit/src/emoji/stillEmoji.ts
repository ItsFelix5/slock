export const STILL_EMOJI_SIZE = 40;

export type StillEmoji = { bitmap: ImageBitmap; x: number; y: number };

export function decodeStillEmoji(url: string): Promise<StillEmoji> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(
        STILL_EMOJI_SIZE / img.naturalWidth,
        STILL_EMOJI_SIZE / img.naturalHeight,
      );
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      createImageBitmap(img, { resizeHeight: height, resizeWidth: width }).then(
        (bitmap) =>
          resolve({
            bitmap,
            x: (STILL_EMOJI_SIZE - width) / 2,
            y: (STILL_EMOJI_SIZE - height) / 2,
          }),
        reject,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function createStillEmojiCache(): (url: string) => Promise<StillEmoji> {
  const stills = new Map<string, Promise<StillEmoji>>();
  return (url) => {
    const cached = stills.get(url);
    if (cached) return cached;
    const pending = decodeStillEmoji(url);
    stills.set(url, pending);
    pending.catch(() => stills.delete(url));
    return pending;
  };
}
