import { service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createMemo, Errored, isPending, Loading, Show } from "solid-js";

const activityStore = service("activity");

function Await(props: { for: () => unknown }) {
  const settled = createMemo(() => {
    props.for();
    return null;
  });
  return <>{settled()}</>;
}

function Notice(props: { label: string; onRetry: () => void }) {
  return (
    <div class="activity-load-notice flex-center gap-sm activity-load-warning">
      <span>{props.label}</span>
      <Button onClick={props.onRetry} size="sm">
        Try again
      </Button>
    </div>
  );
}

export function ActivityFeedStatus(props: { empty: boolean }) {
  return (
    <Errored
      fallback={(_err, reset) => {
        const retry = () => {
          activityStore.retryActivityLoad().catch(() => {});
          reset();
        };
        return (
          <Show
            fallback={<Notice label="Couldn't refresh activity." onRetry={retry} />}
            when={props.empty}
          >
            <div class="activity-load-state activity-load-error empty-state">
              <span>Couldn't load activity.</span>
              <Button onClick={retry} size="sm">
                Try again
              </Button>
            </div>
          </Show>
        );
      }}
    >
      <Loading
        fallback={
          <Show when={props.empty}>
            <div class="activity-load-state empty-state" role="status">
              Loading activity…
            </div>
          </Show>
        }
      >
        <Await for={activityStore.activityFeed} />
      </Loading>
    </Errored>
  );
}

export function ActivityMoreStatus(props: { types?: string; unreadOnly: boolean }) {
  return (
    <Errored
      fallback={(_err, reset) => (
        <Notice
          label="Couldn't load more activity."
          onRetry={() => {
            activityStore.loadMoreActivity(props.types, props.unreadOnly);
            reset();
          }}
        />
      )}
    >
      <Show when={activityStore.activityHasMore(props.types, props.unreadOnly)}>
        <div
          class={[
            "activity-load-notice flex-center gap-sm text-dim text-sm",
            { "activity-load-idle": !isPending(() => activityStore.activityMore()) },
          ]}
        >
          Loading more…
        </div>
      </Show>
    </Errored>
  );
}

export function WhenMoreIdle(props: { children: JSX.Element }) {
  return (
    <Errored fallback={props.children}>
      <Show when={!isPending(() => activityStore.activityMore())}>{props.children}</Show>
    </Errored>
  );
}
