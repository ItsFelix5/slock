import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSignal, flush } from "solid-js";
import TargetComposer from "../../../../packages/plugins/src/composer/client/views/TargetComposer";
import { stamp } from "../../../support/slack";
import { bootComposerHost, type ComposerFixture, mountComposer, settle } from "./composerHarness";

const [threadTs, setThreadTs] = createSignal(stamp("1.0"));
let composer: ComposerFixture;

const open = async (ts: string) => {
  setThreadTs(stamp(ts));
  flush();
  await settle();
};
const shownText = () => document.querySelector(".ql-editor")?.textContent;
const typeAndRender = async (text: string) => {
  composer.type(text);
  await settle();
};
const serverThreads = () => composer.server.state.drafts.map((draft) => draft.threadTs);

beforeEach(async () => {
  await bootComposerHost();
  await open("1.0");
  composer = await mountComposer(
    {
      get threadTs() {
        return threadTs();
      },
    },
    TargetComposer,
  );
});

afterEach(() => composer.dispose());

describe("a thread composer whose thread changes", () => {
  test("keeps the typed draft in the thread it was typed in", async () => {
    await typeAndRender("hello");
    await open("2.0");
    expect(shownText()).toBe("");
    await open("3.0");
    await open("1.0");
    expect(serverThreads()).toEqual([stamp("1.0")]);
    expect(shownText()).toBe("hello");
  });

  test("shows the draft again when it returns before the first save finishes", async () => {
    const release = composer.server.holdWrites();
    await typeAndRender("hello");
    await open("2.0");
    await open("1.0");
    release();
    await settle();
    flush();
    await settle();
    expect(shownText()).toBe("hello");
    expect(serverThreads()).toEqual([stamp("1.0")]);
  });
});
