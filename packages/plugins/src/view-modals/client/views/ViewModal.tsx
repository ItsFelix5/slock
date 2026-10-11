import { BkText, BlockKit } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { Button, IconButton, Modal, ModalHeader, Tooltip, useEscapeClose } from "@slock/ui";
import { Show } from "solid-js";
import "./ViewModal.css";

const modals = service("view-modals");

export default function ViewModal() {
  const view = () => modals.topView();
  const canGoBack = () => modals.viewStack().length > 1;
  useEscapeClose(modals.closeAllViews, () => !!view());

  return (
    <Show when={view()}>
      {(v) => (
        <Modal ariaLabel={v().title.text} class="view-modal-card" onClose={modals.closeAllViews}>
          <ModalHeader onClose={modals.closeAllViews} title={<BkText text={v().title} />}>
            <Show when={canGoBack()}>
              <IconButton
                class="panel-close-btn"
                icon="arrow-left"
                iconSize={14}
                label="Back"
                onClick={modals.popView}
              />
            </Show>
          </ModalHeader>

          <div class="view-modal-content">
            <BlockKit blocks={v().blocks} />
          </div>

          <Show when={v().close || v().submit}>
            <div class="view-modal-footer flex-between">
              <Show when={v().close} fallback={<span />}>
                {(close) => (
                  <Button onClick={modals.closeAllViews} variant="secondary">
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
