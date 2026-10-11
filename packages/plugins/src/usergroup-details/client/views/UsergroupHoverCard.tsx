import { Mrkdwn } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { HoverCard, Icon, type useHoverIntent } from "@slock/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import "./UsergroupHoverCard.css";

const groupActions = service("usergroup-details");

const usergroups = service("usergroups");

export default function UsergroupHoverCard(props: {
  usergroupId: string;
  children?: JSX.Element;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}) {
  const details = () => usergroups.usergroupDetailsById(props.usergroupId);

  return (
    <HoverCard
      anchor={props.anchor}
      hoverIntent={props.hoverIntent}
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
                class="hover-card-action btn-reset flex-center busy"
                onClick={() => {
                  close();
                  groupActions.openUsergroupDetails(props.usergroupId);
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
        if (open) usergroups.ensureUsergroupDetails(props.usergroupId);
      }}
      openWhen={() => !!details()}
      panelClass="usergroup-hovercard"
      width={280}
    >
      {props.children}
    </HoverCard>
  );
}
