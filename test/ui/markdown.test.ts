import { expect, test } from "bun:test";
import { domToMarkdown } from "../../packages/ui/src/markdown";

function markdown(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  return domToMarkdown(root);
}

test("tokens copy as their text form", () => {
  expect(
    markdown(
      '<span data-copy="#general"><svg></svg>general</span> <img data-emoji-name="blobcat"> <span data-emoji-name="wave">👋</span>',
    ),
  ).toBe("#general :blobcat: 👋");
});

test("inline formats and links become markdown", () => {
  expect(
    markdown(
      '<strong>bold </strong><span class="bk-rt-italic">it</span> <s><code>x</code></s> <a href="https://a.test/">docs</a> <a href="https://a.test/">https://a.test</a>',
    ),
  ).toBe("**bold** _it_ ~~`x`~~ [docs](https://a.test/) https://a.test");
});

test("editor blocks keep lines, lists, quotes and code", () => {
  expect(
    markdown(
      '<h2>Title</h2><p>a</p><p></p><ol><li>one<ul><li data-list="checked">two</li></ul></li><li>three</li></ol><blockquote>q</blockquote><pre>**raw**\n</pre>',
    ),
  ).toBe("## Title\na\n\n1. one\n   - [x] two\n2. three\n> q\n```\n**raw**\n```");
});

test("rendered message blocks keep indent, offsets and quoted lines", () => {
  expect(
    markdown(
      '<div><div>intro\n</div><ol start="3" data-indent="1"><li>c</li></ol><blockquote>a\nb</blockquote><div></div></div>',
    ),
  ).toBe("intro\n    3. c\n> a\n> b");
});

test("list items selected without their list keep a marker", () => {
  expect(markdown("<li>a</li><li>b</li>")).toBe("- a\n- b");
});

test("tables become markdown tables", () => {
  expect(
    markdown(
      "<table><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>",
    ),
  ).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |");
});
