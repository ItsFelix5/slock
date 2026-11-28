import { describe, expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import type { ChannelDetails, ChannelId } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createChannelDetailsDraft } from "../../../../packages/plugins/src/channel-details/client/views/createChannelDetailsDraft";
import { partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";

const details = (overrides: Partial<ChannelDetails> = {}): ChannelDetails => ({
  archived: false,
  created: 0,
  id: ch("C1"),
  name: "general",
  private: false,
  purpose: "p",
  topic: "t",
  ...overrides,
});

async function setup(renamed = Promise.resolve(true)) {
  const [open, setOpen] = createRoot(() => createSignal<ChannelId | null>(ch("C1")));
  const refreshed = Promise.withResolvers<void>();
  const flashes: string[] = [];
  const host = await startQueryHost();
  await host.register({
    id: "services",
    setup: (ctx) => {
      ctx.provide(
        "channel-details",
        partialService<Services["channel-details"]>({
          channelDetailsId: open,
          renameChannelById: () => renamed,
        }),
      );
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          flash: (_key, message) => void flashes.push(message),
        }),
      );
    },
  });
  const created = createRoot(() => {
    const [source, setSource] = createSignal<ChannelDetails | undefined>(details());
    return {
      draft: createChannelDetailsDraft(
        source,
        () => refreshed.promise,
        () => false,
      ),
      setSource,
    };
  });
  flush();
  return {
    ...created,
    flashes,
    refreshed: () => refreshed.resolve(),
    show: (id: ChannelId) => {
      setOpen(id);
      created.setSource(details({ id, name: "random" }));
      flush();
    },
  };
}

describe("createChannelDetailsDraft", () => {
  test("seeds fields from the loaded details", async () => {
    const { draft } = await setup();
    expect([draft.name(), draft.topic(), draft.purpose()]).toEqual(["general", "t", "p"]);
    expect(draft.anyDirty()).toBe(false);
  });

  test("keeps an edited field and takes server changes for untouched ones", async () => {
    const { draft, setSource } = await setup();
    draft.setTopic("mine");
    flush();
    setSource(details({ purpose: "server purpose", topic: "server topic" }));
    flush();
    expect(draft.topic()).toBe("mine");
    expect(draft.purpose()).toBe("server purpose");
    expect(draft.anyDirty()).toBe(true);
  });

  test("keeps the draft while details are unavailable", async () => {
    const { draft, setSource } = await setup();
    draft.setName("renamed");
    flush();
    setSource(undefined);
    flush();
    expect(draft.name()).toBe("renamed");
  });

  test("stays saving until the saved details are reloaded", async () => {
    const h = await setup();
    h.draft.setName("renamed");
    flush();
    const saving = h.draft.saveChanges();
    await Bun.sleep(0);
    flush();
    expect(h.draft.saving()).toBe(true);
    h.refreshed();
    await saving;
    flush();
    expect(h.draft.saving()).toBe(false);
    expect(h.flashes).toEqual(["Channel updated."]);
  });

  test("a failed save leaves another channel's draft alone", async () => {
    const rename = Promise.withResolvers<boolean>();
    const h = await setup(rename.promise);
    h.draft.setName("renamed");
    flush();
    const saving = h.draft.saveChanges();
    h.show(ch("C2"));
    expect(h.draft.saving()).toBe(false);
    rename.resolve(false);
    h.refreshed();
    await saving;
    flush();
    expect(h.draft.name()).toBe("random");
  });
});
