import { FloatingPanel, Icon, useHoverIntent } from "@slock/ui";
import { createEffect, createMemo, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import { openUsergroupDetails } from "../../lib/usergroupDetails";
import "./UsergroupHoverCard.css";

const CARD_WIDTH = 280;

// A lightweight preview of a pinggroup shown on hover over an @usergroup
// mention — name, description and member count — without opening the full
// details panel.
export default function UsergroupHoverCard(props: { usergroupId: string; children: JSX.Element }) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { cancelClose, close, open, scheduleClose, scheduleOpen } = useHoverIntent();

  const details = createMemo(() => store.usergroups.usergroupDetailsById(props.usergroupId));

  // Only fetched once the card is actually shown — every @usergroup mention in
  // every rendered message shares this hover card, so fetching on mount would
  // fire a usergroups.list burst for groups the user never hovers over.
  createEffect(() => {
    if (open()) store.usergroups.ensureUsergroupDetails(props.usergroupId);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real controls are the mention button and the card's own button
    <span
      class="usergroup-hovercard-anchor"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <FloatingPanel
        align="start"
        anchor={() => anchorRef}
        class="usergroup-hovercard"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        open={open() && !!details()}
        placement="top"
        style={{ width: `${CARD_WIDTH}px` }}
      >
        <Show when={details()}>
          {(d) => (
            <>
              <div class="usergroup-hovercard-heading flex-align-center">
                <Icon name="user-groups" size={13} />
                <span class="usergroup-hovercard-name">{d().title || `@${d().handle}`}</span>
              </div>

              <Show when={d().description}>
                <div class="usergroup-hovercard-desc text-muted text-sm truncate-lines">
                  {d().description}
                </div>
              </Show>

              <div class="usergroup-hovercard-meta text-dim text-sm">
                {d().memberCount} {d().memberCount === 1 ? "member" : "members"}
              </div>

              <button
                class="usergroup-hovercard-btn btn-reset flex-center"
                onClick={() => {
                  close();
                  openUsergroupDetails(props.usergroupId);
                }}
                type="button"
              >
                <Icon name="user-groups" size={14} />
                View pinggroup
              </button>
            </>
          )}
        </Show>
      </FloatingPanel>
    </span>
  );
}
