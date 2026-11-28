declare module "gifenc" {
  export type Palette = number[][];
  type Pixels = Uint8Array | Uint8ClampedArray;
  type Format = "rgb565" | "rgb444" | "rgba4444";

  export function quantize(rgba: Pixels, maxColors: number, options?: { format?: Format }): Palette;
  export function applyPalette(rgba: Pixels, palette: Palette, format?: Format): Uint8Array;
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): {
    bytes(): Uint8Array;
    finish(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { delay?: number; palette?: Palette; repeat?: number },
    ): void;
  };
}
