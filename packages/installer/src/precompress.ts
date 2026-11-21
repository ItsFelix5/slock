import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { isCompressible } from "./compressible";

function brotli(contents: Uint8Array): Uint8Array {
  return brotliCompressSync(contents, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  });
}

export async function writePrecompressed(path: string, contents: Blob): Promise<void> {
  if (!isCompressible(contents.type)) return;
  const bytes = new Uint8Array(await contents.arrayBuffer());
  await Promise.all([
    Bun.write(`${path}.br`, brotli(bytes)),
    Bun.write(`${path}.gz`, gzipSync(bytes, { level: 9 })),
  ]);
}
