const COMPRESSIBLE_CONTENT_TYPE_RE =
  /^(?:text\/|application\/(?:javascript|json|xml|wasm)|image\/svg\+xml)/i;

export function isCompressible(contentType: string | null): boolean {
  return Boolean(!contentType || COMPRESSIBLE_CONTENT_TYPE_RE.test(contentType));
}
