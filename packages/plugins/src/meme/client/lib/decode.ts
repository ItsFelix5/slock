export type Frame = { delay: number; image: ImageBitmap };
export type Decoded = { frames: Frame[]; height: number; jpeg: boolean; width: number };

const MAX_STILL_SIDE = 1600;
const MAX_ANIMATED_SIDE = 480;
const DEFAULT_DELAY_MS = 100;

function isGif(bytes: Uint8Array): boolean {
  return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
}

function scaled(width: number, height: number, side: number) {
  const ratio = Math.min(1, side / Math.max(width, height));
  return { height: Math.round(height * ratio), width: Math.round(width * ratio) };
}

async function decodeGif(bytes: Uint8Array, signal: AbortSignal): Promise<Decoded> {
  const decoder = new ImageDecoder({ data: bytes, type: "image/gif" });
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1;
    const frames: Frame[] = [];
    let size: { height: number; width: number } | undefined;
    for (let index = 0; index < count; index++) {
      signal.throwIfAborted();
      const { image } = await decoder.decode({ frameIndex: index });
      size ??= scaled(image.displayWidth, image.displayHeight, MAX_ANIMATED_SIDE);
      const bitmap = await createImageBitmap(image, {
        resizeHeight: size.height,
        resizeQuality: "high",
        resizeWidth: size.width,
      });
      frames.push({
        delay: image.duration ? image.duration / 1000 : DEFAULT_DELAY_MS,
        image: bitmap,
      });
      image.close();
    }
    if (!size) throw new Error("This GIF has no frames.");
    return { frames, jpeg: false, ...size };
  } finally {
    decoder.close();
  }
}

export async function decodeImage(blob: Blob, signal: AbortSignal): Promise<Decoded> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isGif(bytes) && typeof ImageDecoder !== "undefined") return decodeGif(bytes, signal);
  const full = await createImageBitmap(blob);
  const size = scaled(full.width, full.height, MAX_STILL_SIDE);
  const image =
    size.width === full.width
      ? full
      : await createImageBitmap(full, {
          resizeHeight: size.height,
          resizeQuality: "high",
          resizeWidth: size.width,
        });
  return {
    frames: [{ delay: DEFAULT_DELAY_MS, image }],
    jpeg: blob.type === "image/jpeg",
    ...size,
  };
}
