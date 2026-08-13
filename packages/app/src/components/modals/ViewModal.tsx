import { BkText, BlockKit } from "@slock/blockkit";
import { Button, Icon, Modal, ModalHeader, Tooltip, useEscapeClose } from "@slock/ui";
import { Show } from "solid-js";
import { store } from "../../lib/store";
import "./ViewModal.css";

export default function ViewModal() {
  const view = () => store.modals.topView();
  const canGoBack = () => store.modals.viewStack().length > 1;
  useEscapeClose(store.modals.closeAllViews, () => !!view());

  return (
    <Show when={view()}>
      {(v) => (
        <Modal
          ariaLabel={v().title.text}
          class="view-modal-card"
          onClose={store.modals.closeAllViews}
        >
          <ModalHeader onClose={store.modals.closeAllViews} title={<BkText text={v().title} />}>
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
          </ModalHeader>

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
        </Modal>
      )}
    </Show>
  );
}
