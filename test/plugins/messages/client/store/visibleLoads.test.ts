import { describe, expect, test } from "bun:test";
import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import type { ChannelId } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { loadNewlyVisible } from "../../../../../packages/plugins/src/messages/client/store/history/visibleLoads";
import { ch } from "../../../../support/slack";
import { slackTs } from "../messageFixture";

const A = ch("C1");
const B = ch("C2");
const view = (id: ChannelId): View => ({ id, kind: "channel" });

function harness() {
  const loads: ChannelId[] = [];
  return createRoot((dispose) => {
    const [views, setViews] = createSignal([view(A)]);
    const [targets, setTargets] = createSignal<ChannelMessageTarget[]>([]);
    loadNewlyVisible({
      atPresent: () => false,
      load: async (id) => void loads.push(id),
      visibleMessageTargets: targets,
      visibleViews: views,
    });
    flush();
    loads.length = 0;
    const show = (...ids: ChannelId[]) => {
      setViews(ids.map(view));
      flush();
    };
    const target = (...ids: ChannelId[]) => {
      setTargets(ids.map((channelId) => ({ channelId, ts: slackTs(1_700_000_000) })));
      flush();
    };
    return { dispose, loads, show, target };
  });
}

describe("loadNewlyVisible", () => {
  test("keeps the window of a pane whose target was cleared before it mounted", () => {
    const { dispose, loads, show, target } = harness();
    target(B);
    target();
    show(A, B);
    expect(loads).toEqual([]);
    dispose();
  });

  test("loads the present when a targeted channel is opened again", () => {
    const { dispose, loads, show, target } = harness();
    target(B);
    show(A, B);
    target();
    show(A);
    show(A, B);
    expect(loads).toEqual([B]);
    dispose();
  });

  test("does not hold a target for a channel that is already mounted", () => {
    const { dispose, loads, show, target } = harness();
    target(A);
    target();
    show(B);
    loads.length = 0;
    show(A);
    expect(loads).toEqual([A]);
    dispose();
  });
});
