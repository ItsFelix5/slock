import { afterEach, beforeAll, expect, test } from "bun:test";
import Quill from "@slock/ui/editor/quill";
import type { JSX } from "@solidjs/web";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import MrkdwnComposer from "../../../src/composer/client/api/MrkdwnComposer";
import RichTextInput from "../../../src/composer/client/views/RichTextInput";
import { bootComposerHost, settle } from "./composerHarness";

beforeAll(bootComposerHost);

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

async function mount(view: (disabled: () => boolean) => JSX.Element) {
  const [disabled, setDisabled] = createSignal(false);
  const host = document.createElement("div");
  document.body.append(host);
  disposers.push(render(() => view(disabled), host));
  await settle();
  const container = host.querySelector(".ql-editor-root");
  const quill = container && Quill.find(container);
  if (!(quill instanceof Quill)) throw new Error("editor did not mount");
  return {
    quill,
    setDisabled(value: boolean) {
      setDisabled(value);
      flush();
    },
  };
}

test("the mrkdwn composer follows its disabled prop", async () => {
  const { quill, setDisabled } = await mount((disabled) => (
    <MrkdwnComposer ariaLabel="test" disabled={disabled()} id="test" onInput={() => {}} value="" />
  ));
  expect(quill.isEnabled()).toBe(true);
  setDisabled(true);
  expect(quill.isEnabled()).toBe(false);
  setDisabled(false);
  expect(quill.isEnabled()).toBe(true);
});

test("the rich text input follows its disabled prop", async () => {
  const { quill, setDisabled } = await mount((disabled) => (
    <RichTextInput disabled={disabled()} onChange={() => {}} />
  ));
  expect(quill.isEnabled()).toBe(true);
  setDisabled(true);
  expect(quill.isEnabled()).toBe(false);
});
