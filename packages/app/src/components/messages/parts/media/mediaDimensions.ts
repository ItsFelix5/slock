export function constrainMediaDimensions(
  width: number | undefined,
  height: number | undefined,
  maxWidth: number,
  maxHeight: number,
  fallbackWidth: number,
  fallbackHeight: number,
  allowUpscale = false,
): { width: number; height: number } {
  if (!(width && height && width > 0 && height > 0))
    return { height: fallbackHeight, width: fallbackWidth };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const constrainedScale = allowUpscale ? scale : Math.min(1, scale);
  return {
    height: Math.round(height * constrainedScale),
    width: Math.round(width * constrainedScale),
  };
}
