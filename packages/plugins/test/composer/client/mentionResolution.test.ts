import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost, type PluginDef } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { parseUserId } from "@slock/slack";
import type { User } from "@slock/types";
import Quill from "@slock/ui/editor/quill";
import { createRoot, createSignal, flush } from "solid-js";
import { useMentionResolution } from "../../../src/composer/client/api/editor/mentionResolution";
import "../../../src/composer/client/lib/quillMentions";
import { sourceOf } from "./composerServices";

const ANN: User = { avatarColor: "#000", id: parseUserId("U1"), name: "ann" };

let host: ReturnType<typeof createHost>;
const [directory, setDirectory] = createSignal<User[]>([]);

function provide<K extends keyof Services>(id: K, service: Services[K]): PluginDef {
  return { id, setup: (ctx) => ctx.provide(id, service) };
}

beforeEach(async () => {
  setDirectory([]);
  host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register(
    provide(
      "users",
      partialService<Services["users"]>({
        currentUser: sourceOf<User | undefined>(undefined),
        userById: (id) => directory().find((user) => user.id === id),
      }),
    ),
    provide("channels", partialService<Services["channels"]>({ channelById: () => undefined })),
    provide("titles", partialService<Services["titles"]>({})),
    provide("usergroups", partialService<Services["usergroups"]>({})),
  );
});
afterEach(() => host.stop());

function mount() {
  const quill = new Quill(document.createElement("div"));
  quill.insertEmbed(0, "mention", { id: "U1", kind: "user", name: "U1" });
  const [editor, setEditor] = createSignal<Quill>();
  const resolve = createRoot(() => useMentionResolution(editor));
  const label = () => quill.root.querySelector<HTMLElement>(".bk-mention")?.dataset.name;
  return { label, resolve, setEditor, quill };
}

describe("mention resolution", () => {
  test("a mention shown as its id gets the name once the user is known", () => {
    const { label, quill, resolve, setEditor } = mount();
    setEditor(quill);
    resolve("U1");
    flush();
    expect(label()).toBe("U1");
    setDirectory([ANN]);
    flush();
    expect(label()).toBe("ann");
  });

  test("a user known right away is resolved on the next flush", () => {
    setDirectory([ANN]);
    const { label, quill, resolve, setEditor } = mount();
    setEditor(quill);
    resolve("U1");
    flush();
    expect(label()).toBe("ann");
  });

  test("resolving again later renames nodes added after the first resolution", () => {
    setDirectory([ANN]);
    const { label, quill, resolve, setEditor } = mount();
    setEditor(quill);
    resolve("U1");
    flush();
    quill.setText("\n");
    quill.insertEmbed(0, "mention", { id: "U1", kind: "user", name: "U1" });
    resolve("U1");
    flush();
    expect(label()).toBe("ann");
  });

  test("names known before the editor exists are applied once it does", () => {
    setDirectory([ANN]);
    const { label, quill, resolve, setEditor } = mount();
    resolve("U1");
    flush();
    setEditor(quill);
    flush();
    expect(label()).toBe("ann");
  });
});
