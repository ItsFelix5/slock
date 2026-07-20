import { fileProxyUrl, type SlackFile } from "@slock/slack-api";
import { Overlay, PanelHeader, useEscapeClose } from "@slock/ui";
import { createResource, createSignal, type JSX, Match, Show, Switch } from "solid-js";
import { parseEml } from "./mailParse";
import "./FileViewer.css";

export default function FileViewerTrigger(props: {
  file: SlackFile;
  kind: "pdf" | "mail";
  children: JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button
        class="message-file-card flex-align-center btn-reset"
        onClick={() => setOpen(true)}
        type="button"
      >
        {props.children}
      </button>
      <Show when={open()}>
        <FileLightbox file={props.file} kind={props.kind} onClose={() => setOpen(false)} />
      </Show>
    </>
  );
}

function FileLightbox(props: { file: SlackFile; kind: "pdf" | "mail"; onClose: () => void }) {
  useEscapeClose(props.onClose);
  const name = () => props.file.title || props.file.name;
  return (
    <Overlay onClose={props.onClose}>
      <div class="file-viewer-card flex-col">
        <PanelHeader onClose={props.onClose}>
          <div class="file-viewer-title">{name()}</div>
        </PanelHeader>
        <Switch>
          <Match when={props.kind === "pdf"}>
            <iframe
              class="file-viewer-frame"
              src={fileProxyUrl(props.file.urlPrivate)}
              title={name()}
            />
          </Match>
          <Match when={props.kind === "mail"}>
            <MailBody file={props.file} />
          </Match>
        </Switch>
      </div>
    </Overlay>
  );
}

function MailBody(props: { file: SlackFile }) {
  const [raw] = createResource(
    () => props.file.urlPrivate,
    (url) => fetch(fileProxyUrl(url)).then((res) => res.text()),
  );
  const mail = () => {
    const text = raw();
    return text === undefined ? undefined : parseEml(text);
  };
  return (
    <Show
      fallback={<div class="file-viewer-loading flex-center text-dim text-sm">Loading email…</div>}
      when={mail()}
    >
      {(m) => (
        <div class="file-viewer-mail flex-col">
          <div class="file-viewer-mail-headers">
            <Show when={m().subject}>
              <div class="file-viewer-mail-subject">{m().subject}</div>
            </Show>
            <Show when={m().from}>
              <div class="file-viewer-mail-meta">
                <strong>From:</strong> {m().from}
              </div>
            </Show>
            <Show when={m().to}>
              <div class="file-viewer-mail-meta">
                <strong>To:</strong> {m().to}
              </div>
            </Show>
            <Show when={m().date}>
              <div class="file-viewer-mail-meta">
                <strong>Date:</strong> {m().date}
              </div>
            </Show>
          </div>
          <Switch
            fallback={<div class="file-viewer-mail-empty text-dim text-sm">No readable body.</div>}
          >
            <Match when={m().bodyHtml}>
              {(html) => (
                // No allow-scripts/allow-same-origin: this renders a
                // stranger's HTML email, so it gets the same sandboxing as
                // an inert preview — no script execution, no DOM/cookie
                // access to the rest of the app.
                <iframe
                  class="file-viewer-frame file-viewer-mail-frame"
                  sandbox=""
                  srcdoc={html()}
                  title="Email body"
                />
              )}
            </Match>
            <Match when={m().bodyText}>
              {(text) => <pre class="file-viewer-mail-text">{text()}</pre>}
            </Match>
          </Switch>
        </div>
      )}
    </Show>
  );
}
