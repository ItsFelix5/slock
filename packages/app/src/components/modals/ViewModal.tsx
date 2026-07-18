import { BkText, BlockKit } from "@slock/blockkit";
import { Button, Icon, Overlay, Tooltip, useEscapeClose } from "@slock/ui";
import { Show } from "solid-js";
import { store } from "../../lib/store";
import "./ViewModal.css";

// Renders modals apps push via `views.open`/`views.push` (delivered over the
// gateway as `view_opened`). We only relay the shortcut/action request — the
// app's own backend owns the interactivity round-trip — so this is a
// read-only viewer: Submit has nowhere real to send data, and is disabled
// rather than pretending to succeed.
export default function ViewModal() {
  useEscapeClose(store.modals.closeAllViews);

  const view = () => store.modals.topView();
  const canGoBack = () => store.modals.viewStack().length > 1;

  return (
    <Show when={view()}>
      {(v) => (
        <Overlay onClose={store.modals.closeAllViews}>
          <div aria-modal="true" class="view-modal-card modal-card" role="dialog">
            <div class="view-modal-header flex-between">
              <div class="view-modal-title flex-between">
                <Show when={canGoBack()}>
                  <Tooltip content="Back">
                    <button
                      aria-label="Back"
                      class="panel-close-btn"
                      onClick={store.modals.popView}
                      type="button"
                    >
                      <Icon name="arrow-left" size={14} />
                    </button>
                  </Tooltip>
                </Show>
                <h2>
                  <BkText text={v().title} />
                </h2>
              </div>
              <Tooltip content="Close">
                <button
                  aria-label="Close"
                  class="panel-close-btn"
                  onClick={store.modals.closeAllViews}
                  type="button"
                >
                  <Icon name="close" size={12} />
                </button>
              </Tooltip>
            </div>

            <div class="view-modal-content">
              <BlockKit blocks={v().blocks} />
            </div>

            <Show when={v().close || v().submit}>
              <div class="view-modal-footer flex-between">
                <Show when={v().close} fallback={<span />}>
                  {(close) => (
                    <Button onClick={store.modals.closeAllViews} variant="secondary">
                      <BkText text={close()} />
                    </Button>
                  )}
                </Show>
                <Show when={v().submit}>
                  {(submit) => (
                    <Tooltip content="This app's response can't be delivered from here yet">
                      <Button disabled variant="primary">
                        <BkText text={submit()} />
                      </Button>
                    </Tooltip>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
