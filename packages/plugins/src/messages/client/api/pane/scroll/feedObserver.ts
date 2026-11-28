export function observeFeed(scroller: HTMLElement, onChange: () => void) {
  const resize = new ResizeObserver(onChange);
  const watched = new Set<Element>();

  function watchChildren() {
    for (const child of watched) {
      if (child.parentElement === scroller) continue;
      resize.unobserve(child);
      watched.delete(child);
    }
    for (const child of scroller.children) {
      if (watched.has(child)) continue;
      resize.observe(child);
      watched.add(child);
    }
  }

  const mutations = new MutationObserver((records) => {
    watchChildren();
    if (records.some((record) => record.removedNodes.length)) onChange();
  });

  resize.observe(scroller);
  mutations.observe(scroller, { childList: true });
  watchChildren();

  return () => {
    resize.disconnect();
    mutations.disconnect();
  };
}
