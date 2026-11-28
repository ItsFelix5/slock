import { BkText, BlockKit, type ViewState, validateView } from "@slock/blockkit";
import { isRecord } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import { apiPost } from "@slock/slack/client";
import type { ApiReply, ModalView, TextObject } from "@slock/types";
import { Button, createResetSignal, IconButton, Modal, ModalHeader } from "@slock/ui";
import { createEffect, Show } from "solid-js";
import { createViewSession } from "../viewSession";
import "./ViewModal.css";

const modals = service("view-modals");
const CANCEL: TextObject = { text: "Cancel", type: "plain_text" };

type Errors = Record<string, string>;
type Submission = { state: ReturnType<ViewState["snapshot"]>; view: ModalView };
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
  const [failed, setFailed] = createResetSignal(() => view()?.id, false);

  createEffect(
    () => modals.viewStack().map((open) => open.id),
    (openIds) => void session.forget(openIds),
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
    return !!v && (submission.pending(v.id) || (!!v.submit_disabled && !session.touched(v.id)));
  };

  const fail = (submitted: ModalView, reply?: ApiReply<SubmitReply>) => {
    const fieldErrors = reply && !reply.ok ? errorMap(reply.details) : undefined;
    if (fieldErrors) session.setErrorsFor(submitted.id, fieldErrors);
    else if (view()?.id === submitted.id) setFailed(true);
  };

  const submission = defineMutation<Submission, ApiReply<SubmitReply>>({
    key: ({ view }) => view.id,
    mode: "single",
    onError: (_error, { view }) => fail(view),
    onSuccess: (reply, { view }) => (reply.ok ? finish(view, reply) : fail(view, reply)),
    run: ({ state, view }) => apiPost<SubmitReply>("/api/views/submit", { state, viewId: view.id }),
  });

  const submit = () => {
    const v = view();
    if (!v || submitBlocked()) return;
    const state = session.stateFor(v.id).snapshot(v.blocks);
    const problems = validateView(v.blocks, state);
    session.setErrorsFor(v.id, problems);
    if (Object.keys(problems).length) return;
    setFailed(false);
    void submission.run({ state, view: v });
  };

  const submitOnShortcut = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || !view()?.submit) return;
    event.preventDefault();
    submit();
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
