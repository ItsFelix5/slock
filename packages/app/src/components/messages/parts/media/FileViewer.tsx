import { Button, Icon, Overlay, PanelHeader, useEscapeClose } from "@slock/ui";
import {
  createResource,
  createSignal,
  createUniqueId,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { resolveMediaUrl, type SlackFile } from "../../../../lib/api";
import "./FileViewer.css";
import { parseEml } from "./mailParse";

const EMAIL_HEAD_RE = /<head(?:\s[^>]*)?>/i;
const EMAIL_PREVIEW_POLICY =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: cid:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">";

export default function FileViewer(props: {
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
  const titleId = createUniqueId();
  return (
    <Overlay ariaLabelledBy={titleId} onClose={props.onClose}>
      <div class="file-viewer-card flex-col">
        <PanelHeader onClose={props.onClose}>
          <div class="file-viewer-header-main">
            <div class="file-viewer-title" id={titleId}>
              {name()}
            </div>
            <a
              class="file-viewer-open-link flex-align-center"
              href={props.file.urlPrivate}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon name="download" size={14} />
              Open original
            </a>
          </div>
        </PanelHeader>
        <Switch>
          <Match when={props.kind === "pdf"}>
            <PdfBody file={props.file} />
          </Match>
          <Match when={props.kind === "mail"}>
            <MailBody file={props.file} />
          </Match>
        </Switch>
      </div>
    </Overlay>
  );
}

function PdfBody(props: { file: SlackFile }) {
  const [loaded, setLoaded] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const name = () => props.file.title || props.file.name;

  return (
    <Show
      fallback={
        <div class="file-viewer-error flex-center flex-col">
          <div>Couldn't preview this PDF.</div>
          <Button
            onClick={() => {
              setLoaded(false);
              setFailed(false);
            }}
            size="sm"
          >
            Try again
          </Button>
        </div>
      }
      when={!failed()}
    >
      <div class="file-viewer-frame-wrap">
        <iframe
          class="file-viewer-frame file-viewer-pdf-frame"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={resolveMediaUrl(props.file.urlPrivate)}
          sandbox=""
          title={name()}
        />
        <Show when={!loaded()}>
          <div aria-live="polite" class="file-viewer-loading flex-center text-dim text-sm">
            Loading PDF…
          </div>
        </Show>
      </div>
    </Show>
  );
}

function MailBody(props: { file: SlackFile }) {
  let fetchController: AbortController | undefined;
  const [raw, { refetch }] = createResource(
    () => props.file.urlPrivate,
    async (url) => {
      fetchController?.abort();
      fetchController = new AbortController();
      const response = await fetch(resolveMediaUrl(url), { signal: fetchController.signal });
      if (!response.ok) throw new Error(`Email preview failed (${response.status})`);
      return response.text();
    },
  );
  onCleanup(() => fetchController?.abort());
  const mail = () => {
    const text = raw();
    return text === undefined ? undefined : parseEml(text);
  };
  return (
    <Switch fallback={<div class="file-viewer-mail-empty text-dim text-sm">No readable body.</div>}>
      <Match when={raw.loading}>
        <div class="file-viewer-loading flex-center text-dim text-sm">Loading email…</div>
      </Match>
      <Match when={raw.error}>
        <div class="file-viewer-error flex-center flex-col">
          <div>Couldn't preview this email.</div>
          <Button onClick={() => refetch()} size="sm">
            Try again
          </Button>
        </div>
      </Match>
      <Match when={mail()}>
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
              fallback={
                <div class="file-viewer-mail-empty text-dim text-sm">No readable body.</div>
              }
            >
              <Match when={m().bodyHtml}>
                {(html) => (
                  <iframe
                    class="file-viewer-frame file-viewer-mail-frame"
                    sandbox=""
                    srcdoc={emailSrcdoc(html())}
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
      </Match>
    </Switch>
  );
}

function emailSrcdoc(html: string): string {
  return EMAIL_HEAD_RE.test(html)
    ? html.replace(EMAIL_HEAD_RE, (head) => `${head}${EMAIL_PREVIEW_POLICY}`)
    : `${EMAIL_PREVIEW_POLICY}${html}`;
}
