import Quill from "quill";

export function wireEmbedCaretEscape(quill: Quill) {
  const handleSelectionChange = () => {
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    if (!(selection?.isCollapsed && anchor && quill.root.contains(anchor))) return;
    const anchorElement = anchor instanceof Element ? anchor : anchor.parentElement;
    if (anchorElement?.closest('[contenteditable="true"]') !== quill.root) return;
    const content = anchorElement.closest('[contenteditable="false"]');
    const blot = content && Quill.find(content, true);
    if (!blot || blot instanceof Quill || blot === quill.scroll) return;
    const index = quill.getIndex(blot);
    quill.setSelection(selection.anchorOffset > 0 ? index + 1 : index, 0, "silent");
  };
  document.addEventListener("selectionchange", handleSelectionChange);
  return () => document.removeEventListener("selectionchange", handleSelectionChange);
}
