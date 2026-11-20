import { service } from "@slock/core/solid";
import { Button, initRovingTabIndexDefault } from "@slock/ui";
import { For, Loading, onSettled, Show } from "solid-js";
import LaterItem from "./LaterItem";
import "./LaterView.css";

const later = service("later");

export default function LaterView() {
  onSettled(() => {
    void later.ensureLaterLoaded();
  });
  let listRef: HTMLDivElement | undefined;
  initRovingTabIndexDefault(() => listRef, later.laterItems);

  return (
    <div class="later-view sidebar-view-panel" ref={listRef}>
      <Loading fallback={<div class="later-empty empty-state">Loading saved items…</div>}>
        <Show
          fallback={
            <div class="later-load-error empty-state flex-col">
              <span>Couldn't load saved items.</span>
              <Button onClick={later.ensureLaterLoaded} size="sm">
                Try again
              </Button>
            </div>
          }
          when={!later.laterLoadFailed()}
        >
          <Show
            fallback={<div class="later-empty empty-state">Nothing saved for later.</div>}
            when={later.laterItems().length > 0}
          >
            <For each={later.laterItems()}>{(item) => <LaterItem item={item} />}</For>
          </Show>
        </Show>
      </Loading>
    </div>
  );
}
