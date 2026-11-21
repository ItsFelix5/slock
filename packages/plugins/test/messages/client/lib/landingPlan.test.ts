import { describe, expect, test } from "bun:test";
import { ch } from "@slock/slack/testing";
import {
  initialLandingState,
  type LandingInput,
  type LandingState,
  planLanding,
} from "../../../../src/messages/client/lib/landingPlan";
import { slackTs } from "../messageFixture";

const A = ch("C1");
const B = ch("C2");
const target = { channelId: A, ts: slackTs(1_700_000_000) };

function input(patch: Partial<LandingInput> = {}): LandingInput {
  return {
    anchor: undefined,
    hasElement: true,
    hasMessages: true,
    hasNewer: false,
    target: null,
    targetLoaded: false,
    viewId: A,
    ...patch,
  };
}

const positioned: LandingState = { ...initialLandingState, lastViewId: A, positionedViewId: A };

describe("planLanding", () => {
  test("switching views forgets the positioned view and reports the switch", () => {
    const plan = planLanding(positioned, input({ anchor: 5, viewId: B }));
    expect(plan.viewSwitched).toBe(true);
    expect(plan.state.lastViewId).toBe(B);
    expect(plan.state.positionedViewId).toBe(B);
    expect(plan.step).toEqual({ anchor: 5, kind: "land-initial" });
  });

  test("the same view is not a switch and does not land twice", () => {
    const plan = planLanding(positioned, input());
    expect(plan.viewSwitched).toBe(false);
    expect(plan.step).toEqual({ kind: "idle" });
  });

  test("nothing lands before the element and messages exist", () => {
    expect(planLanding(initialLandingState, input({ hasElement: false })).step.kind).toBe("idle");
    expect(planLanding(initialLandingState, input({ hasMessages: false })).step.kind).toBe("idle");
    expect(planLanding(initialLandingState, input({ viewId: undefined })).step.kind).toBe("idle");
  });

  test("a view switch is reported even when nothing can land yet", () => {
    const plan = planLanding(positioned, input({ hasElement: false, viewId: B }));
    expect(plan.viewSwitched).toBe(true);
    expect(plan.state.positionedViewId).toBeUndefined();
  });

  test("without an unread anchor or newer history the landing waits for the divider", () => {
    const plan = planLanding(initialLandingState, input());
    expect(plan.step).toEqual({ kind: "wait-divider" });
    expect(plan.state.positionedViewId).toBeUndefined();
  });

  test("newer history lands immediately without an anchor", () => {
    const plan = planLanding(initialLandingState, input({ hasNewer: true }));
    expect(plan.step).toEqual({ anchor: undefined, kind: "land-initial" });
    expect(plan.state.positionedViewId).toBe(A);
  });

  test("a non finite anchor lands without a divider", () => {
    const plan = planLanding(initialLandingState, input({ anchor: Number.NaN }));
    expect(plan.step).toEqual({ anchor: undefined, kind: "land-initial" });
  });

  test("a loaded target lands once, then a repeat of the same target is a reload", () => {
    const first = planLanding(initialLandingState, input({ target, targetLoaded: true }));
    expect(first.step).toEqual({ kind: "land-target", reloaded: false, target });
    expect(first.state.positionedViewId).toBe(A);
    const again = planLanding(first.state, input({ target, targetLoaded: true }));
    expect(again.step).toEqual({ kind: "land-target", reloaded: true, target });
  });

  test("an unloaded target is requested once", () => {
    const first = planLanding(initialLandingState, input({ target }));
    expect(first.step).toEqual({ kind: "request-target", target });
    const again = planLanding(first.state, input({ target }));
    expect(again.step).toEqual({ kind: "idle" });
  });

  test("a target for another view falls through to the initial landing", () => {
    const plan = planLanding(
      initialLandingState,
      input({ hasNewer: true, target: { channelId: B, ts: target.ts } }),
    );
    expect(plan.step.kind).toBe("land-initial");
  });
});
