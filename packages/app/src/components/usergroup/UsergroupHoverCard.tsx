import { Mrkdwn } from "@slock/blockkit";
import { HoverCard, Icon } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import { openUsergroupDetails } from "../../lib/usergroupDetails";
import "./UsergroupHoverCard.css";

export default function UsergroupHoverCard(props: { usergroupId: string; children: JSX.Element }) {
  const details = createMemo(() => store.usergroups.usergroupDetailsById(props.usergroupId));

  return (
    <HoverCard
      content={(close) => (
        <Show when={details()}>
          {(d) => (
            <>
              <div class="usergroup-hovercard-heading flex-align-center">
                <Icon name="user-groups" size={13} />
                <span class="usergroup-hovercard-name">{d().title || `@${d().handle}`}</span>
              </div>

              <Show when={d().description}>
                <div class="usergroup-hovercard-desc text-muted text-sm truncate-lines">
                  <Mrkdwn text={d().description ?? ""} />
                </div>
              </Show>

              <div class="usergroup-hovercard-meta text-dim text-sm">
                {d().memberCount} {d().memberCount === 1 ? "member" : "members"}
              </div>

              <button
                class="hover-card-action btn-reset flex-center"
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
      )}
      onOpenChange={(open) => {
        if (open) store.usergroups.ensureUsergroupDetails(props.usergroupId);
      }}
      openWhen={() => !!details()}
      panelClass="usergroup-hovercard"
      width={280}
    >
      {props.children}
    </HoverCard>
  );
}
