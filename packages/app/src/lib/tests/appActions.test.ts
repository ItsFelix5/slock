// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createAppActions } from "../appActions";

function createHarness() {
  const selected: { id: string; kind: string }[] = [];
  const targets: { channelId: string; ts: string }[] = [];
  const nav: string[] = [];
  const reopened: [string, boolean][] = [];
  const cleared: string[] = [];
  const deps = {
    activity: {},
    dms: {
      closedDmIds: Object.fromEntries([["D123", true]]),
      dmById: () => undefined,
      setClosedDmIds: (id: string, closed: boolean) => reopened.push([id, closed]),
    },
    later: {},
    realtime: {},
    setActiveView: () => {},
    setActiveViewImplRef: { current: () => {} },
    unread: { clearChannelUnread: (id: string) => cleared.push(id) },
    viewState: {
      setChannelMessageTarget: (target: { channelId: string; ts: string }) => targets.push(target),
      setNav: (value: string) => nav.push(value),
      setSelected: (view: { id: string; kind: string }) => selected.push(view),
    },
  } as unknown as Parameters<typeof createAppActions>[0];
  return { actions: createAppActions(deps), cleared, nav, reopened, selected, targets };
}

describe("openChannelMessage", () => {
  test("opens regular DM ids as DMs and exits the current feed", () => {
    const harness = createHarness();

    harness.actions.openChannelMessage("D123", "100.200");

    expect(harness.selected).toEqual([{ id: "D123", kind: "dm" }]);
    expect(harness.targets).toEqual([{ channelId: "D123", ts: "100.200" }]);
    expect(harness.nav).toEqual(["home"]);
    expect(harness.reopened).toEqual([["D123", false]]);
    expect(harness.cleared).toEqual(["D123"]);
  });

  test("can preserve a feed while focusing a message", () => {
    const harness = createHarness();

    harness.actions.openChannelMessage("C123", "100.200", { keepNav: true });

    expect(harness.selected).toEqual([{ id: "C123", kind: "channel" }]);
    expect(harness.nav).toEqual([]);
  });
});
