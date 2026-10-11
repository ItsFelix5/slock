import { Slot, service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import { type Accessor, createSignal, Show } from "solid-js";
import { SidebarSkeleton } from "./rows/SidebarSkeleton";
import SidebarUnreadEdgeIndicator from "./SidebarUnreadEdgeIndicator";

function ResourceError(props: {
  label: string;
  loading: Accessor<boolean>;
  retry: () => Promise<unknown>;
}) {
  return (
    <div class="sidebar-resource-error flex-between">
      <span>{props.label}</span>
      <Button disabled={props.loading()} onClick={() => void props.retry()} size="sm">
        {props.loading() ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}

export default function HomeView(props: { unreadsOnly: Accessor<boolean> }) {
  const bootstrap = service("bootstrap");
  const channels = service("channels");
  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement>();
  const preferencesLoading = () => bootstrap.userPrefs.isFetching;

  return (
    <div class="sidebar-scroll-wrap">
      <div class="sidebar-scroll" ref={setScrollEl}>
        <Show
          fallback={<SidebarSkeleton />}
          when={
            !(bootstrap.bootstrap.isFetching || channels.sectionsLoading() || preferencesLoading())
          }
        >
          <Show when={bootstrap.userPrefs.error}>
            <ResourceError
              label="Couldn't load preferences."
              loading={preferencesLoading}
              retry={bootstrap.retryUserPrefs}
            />
          </Show>
          <Show when={channels.sectionsError()}>
            <ResourceError
              label="Couldn't load custom sections."
              loading={channels.sectionsLoading}
              retry={channels.retrySections}
            />
          </Show>
          <Slot point="home.section" unreadsOnly={props.unreadsOnly} />
        </Show>
      </div>
      <SidebarUnreadEdgeIndicator containerRef={scrollEl} />
    </div>
  );
}
