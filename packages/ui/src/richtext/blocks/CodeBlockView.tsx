import { createEffect } from "solid-js";
import type { CodeBlock } from "../docModel";
import { pathKey } from "../selection";

/** Same empty-string DOM quirk as `RunView`'s `bindLeafText` — see that comment. A fresh
 * codeblock starts with `text: ""`, and Solid's JSX text child would leave the `<pre>` childless
 * until the first keystroke tears the node down again. Manage the Text node directly instead. */
function bindPreText(el: HTMLElement, text: () => string) {
  const node = document.createTextNode(text());
  el.appendChild(node);
  createEffect(() => {
    const value = text();
    if (node.data !== value) node.data = value;
  });
}

export default function CodeBlockView(props: { block: CodeBlock; blockPath: number[] }) {
  return (
    <pre
      class="rt-block bk-codeblock"
      data-rt-path={pathKey(props.blockPath)}
      ref={(el) => bindPreText(el, () => props.block.text)}
    />
  );
}
