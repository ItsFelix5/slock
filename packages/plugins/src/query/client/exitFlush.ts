export function installExitFlush(flush: () => void): () => void {
  const onHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", flush);
  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", flush);
  };
}
