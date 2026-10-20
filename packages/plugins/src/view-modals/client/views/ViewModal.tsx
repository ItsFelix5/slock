import { BkText, BlockKit, validateView } from "@slock/blockkit";
import { isRecord } from "@slock/core";
import { service } from "@slock/core/solid";
import { apiPost } from "@slock/slack";
import type { ModalView, TextObject } from "@slock/types";
import { Button, IconButton, Modal, ModalHeader } from "@slock/ui";
import { createEffect, createSignal, on, Show } from "solid-js";
import { createViewSession } from "../viewSession";
import "./ViewModal.css";

const modals = service("view-modals");
const CANCEL: TextObject = { text: "Cancel", type: "plain_text" };

type Errors = Record<string, string>;
type SubmitReply = {
  errors?: Errors;
  response_action?: string;
  toast_message?: string;
  view?: ModalView;
};

function errorMap(details: unknown): Errors | undefined {
  if (!(isRecord(details) && isRecord(details.errors))) return;
  return Object.fromEntries(
    Object.entries(details.errors).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default function ViewModal() {
  const session = createViewSession();
  const view = () => modals.topView();
  const canGoBack = () => modals.viewStack().length > 1;
  const [submitting, setSubmitting] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  createEffect(() => session.forget(modals.viewStack().map((open) => open.id)));
  createEffect(
    on(
      () => view()?.id,
      () => setFailed(false),
    ),
  );

  const notifyClosed = (closing: ModalView) =>
    apiPost("/api/views/close", {
      rootViewId: modals.viewStack()[0]?.id,
      viewId: closing.id,
    }).catch(() => {});

  const dismissAll = () => {
    const top = view();
    if (top) void notifyClosed(top);
    modals.closeAllViews();
  };

  const dismissTop = () => {
    const top = view();
    if (!top) return;
    void notifyClosed(top);
    if (canGoBack()) modals.popView();
    else modals.closeAllViews();
  };

  const context = () => {
    const v = view();
    if (!v) return;
    return {
      appId: v.app_id,
      botId: v.bot_id,
      view: {
        blocks: () => view()?.blocks ?? [],
        errors: () => session.errorsFor(v.id),
        id: v.id,
        state: session.stateFor(v.id),
      },
    };
  };

  const finish = (submitted: ModalView, reply: SubmitReply) => {
    if (reply.response_action === "errors" && reply.errors) {
      session.setErrorsFor(submitted.id, reply.errors);
    } else if (reply.response_action === "update" && reply.view) {
      modals.updateView(reply.view);
    } else if (reply.response_action === "push" && reply.view) {
      modals.openView({
        ...reply.view,
        previous_view_id: reply.view.previous_view_id ?? submitted.id,
      });
    } else {
      if (reply.response_action === "clear") modals.closeAllViews();
      else modals.popView();
      if (reply.toast_message) modals.showToast(reply.toast_message);
    }
  };

  const submitBlocked = () => {
    const v = view();
    return submitting() || (!!v?.submit_disabled && !session.touched(v.id));
  };

  const submit = async () => {
    const v = view();
    if (!v || submitBlocked()) return;
    const state = session.stateFor(v.id).snapshot(v.blocks);
    const problems = validateView(v.blocks, state);
    session.setErrorsFor(v.id, problems);
    if (Object.keys(problems).length) return;
    setSubmitting(true);
    setFailed(false);
    const reply = await apiPost<SubmitReply>("/api/views/submit", { state, viewId: v.id }).catch(
      () => undefined,
    );
    setSubmitting(false);
    if (reply?.ok) return finish(v, reply);
    const fieldErrors = reply && !reply.ok ? errorMap(reply.details) : undefined;
    if (fieldErrors) session.setErrorsFor(v.id, fieldErrors);
    else setFailed(true);
  };

  const submitOnShortcut = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || !view()?.submit) return;
    event.preventDefault();
    void submit();
  };

  return (
    <Show when={view()}>
      {(v) => (
        <Modal ariaLabel={v().title.text} class="view-modal-card" onClose={dismissAll}>
          <ModalHeader onClose={dismissAll} title={<BkText text={v().title} />}>
            <Show when={canGoBack()}>
              <IconButton
                class="panel-close-btn"
                icon="arrow-left"
                iconSize={14}
                label="Back"
                onClick={dismissTop}
              />
            </Show>
          </ModalHeader>

          <div class="view-modal-content" onKeyDown={submitOnShortcut}>
            <BlockKit blocks={v().blocks} context={context()} />
          </div>

          <Show when={v().close || v().submit}>
            <div class="view-modal-footer flex-between">
              <Show when={v().close ?? (v().submit ? CANCEL : null)} fallback={<span />}>
                {(close) => (
                  <Button
                    onClick={v().clear_on_close ? dismissAll : dismissTop}
                    variant="secondary"
                  >
                    <BkText text={close()} />
                  </Button>
                )}
              </Show>
              <Show when={failed()}>
                <span class="inline-feedback-error">Submit failed</span>
              </Show>
              <Show when={v().submit}>
                {(submitLabel) => (
                  <Button disabled={submitBlocked()} onClick={submit} variant="primary">
                    <BkText text={submitLabel()} />
                  </Button>
                )}
              </Show>
            </div>
          </Show>
        </Modal>
      )}
    </Show>
  );
}
