import type { ChannelMessageTarget } from "@slock/plugins/conversations/client/api/types";
import type { ChannelId } from "@slock/types";

export interface LandingState {
  lastViewId: ChannelId | undefined;
  positionedViewId: ChannelId | undefined;
  requestedTarget: ChannelMessageTarget | null;
}

export interface LandingInput {
  anchor: number | undefined;
  hasElement: boolean;
  hasMessages: boolean;
  hasNewer: boolean;
  target: ChannelMessageTarget | null;
  targetLoaded: boolean;
  viewId: ChannelId | undefined;
}

export type LandingStep =
  | { kind: "idle" }
  | { kind: "land-target"; reloaded: boolean; target: ChannelMessageTarget }
  | { kind: "request-target"; target: ChannelMessageTarget }
  | { kind: "wait-divider" }
  | { kind: "land-initial"; anchor: number | undefined };

export interface LandingPlan {
  state: LandingState;
  step: LandingStep;
  viewSwitched: boolean;
}

export const initialLandingState: LandingState = {
  lastViewId: undefined,
  positionedViewId: undefined,
  requestedTarget: null,
};

export function planLanding(state: LandingState, input: LandingInput): LandingPlan {
  const viewSwitched = input.viewId !== state.lastViewId;
  const current: LandingState = viewSwitched
    ? { ...state, lastViewId: input.viewId, positionedViewId: undefined }
    : state;
  const { target, viewId } = input;
  const idle: LandingPlan = { state: current, step: { kind: "idle" }, viewSwitched };
  if (!(viewId && input.hasElement)) return idle;

  if (target?.channelId === viewId) {
    if (input.targetLoaded)
      return {
        state: { ...current, positionedViewId: viewId, requestedTarget: target },
        step: { kind: "land-target", reloaded: current.requestedTarget === target, target },
        viewSwitched,
      };
    if (current.requestedTarget === target) return idle;
    return {
      state: { ...current, requestedTarget: target },
      step: { kind: "request-target", target },
      viewSwitched,
    };
  }

  if (current.positionedViewId === viewId || !input.hasMessages) return idle;
  if (input.anchor === undefined && !input.hasNewer)
    return { state: current, step: { kind: "wait-divider" }, viewSwitched };
  return {
    state: { ...current, positionedViewId: viewId },
    step: {
      kind: "land-initial",
      anchor:
        input.anchor !== undefined && Number.isFinite(input.anchor) ? input.anchor : undefined,
    },
    viewSwitched,
  };
}
