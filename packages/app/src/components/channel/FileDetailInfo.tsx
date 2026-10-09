import { CLOCK_24H, type SlackFile, type SlackFileDetail } from "@slock/types";
import { Avatar, Button, IconButton } from "@slock/ui";
import { createSignal, For, type JSX, Show } from "solid-js";
import { renameFile } from "../../lib/api";
import { flashCaughtError } from "../../lib/feedback";
import { store } from "../../lib/store";
import { formatSize } from "../messages/parts/media/FileCardInfo";

const ACCESS_LABELS: Record<string, string> = {
  none: "Only people invited",
  read: "Anyone in the workspace can view",
  write: "Anyone in the workspace can edit",
};

const LEVEL_LABELS: Record<string, string> = {
  owner: "Owner",
  read: "Can view",
  write: "Can edit",
};

export function formatDateTime(value: number | string | undefined): string {
  const seconds = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    ...CLOCK_24H,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function UserChip(props: { userId: string }) {
  const user = () => store.users.userById(props.userId);
  return (
    <span class="file-detail-user flex-align-center">
      <Show when={user()}>{(known) => <Avatar size="small" user={known()} />}</Show>
      <span class="truncate">{user()?.name ?? props.userId}</span>
    </span>
  );
}

function Row(props: { children: JSX.Element; label: string }) {
  return (
    <div class="file-detail-row">
      <span class="file-detail-row-label text-dim">{props.label}</span>
      <span class="file-detail-row-value">{props.children}</span>
    </div>
  );
}

export function FileTitle(props: {
  editable: boolean;
  file: SlackFile;
  onRenamed: (title: string) => void;
}) {
  const current = () => props.file.title || props.file.name;
  const [draft, setDraft] = createSignal<string | null>(null);

  async function commit() {
    const title = draft()?.trim();
    setDraft(null);
    if (!title || title === current()) return;
    try {
      await renameFile(props.file.id, title);
      props.onRenamed(title);
    } catch (error) {
      flashCaughtError(props.file.id, error, "Couldn't rename the file");
    }
  }

  return (
    <Show
      fallback={
        <input
          aria-label="File name"
          class="file-detail-title-input text-field"
          onBlur={() => void commit()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setDraft(null);
          }}
          ref={(element) => queueMicrotask(() => element.select())}
          value={draft() ?? ""}
        />
      }
      when={draft() === null}
    >
      <span class="file-detail-title flex-align-center">
        <span class="truncate">{current()}</span>
        <Show when={props.editable}>
          <IconButton
            icon="edit"
            iconSize={14}
            label="Rename"
            onClick={() => setDraft(current())}
            size="sm"
          />
        </Show>
      </span>
    </Show>
  );
}

export default function FileDetailInfo(props: {
  detail: SlackFileDetail | undefined;
  file: SlackFile;
}) {
  const [copied, setCopied] = createSignal(false);

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      flashCaughtError(props.file.id, error, "Couldn't copy the link");
    }
  }

  return (
    <div class="file-detail-info flex-col">
      <Show when={props.detail?.ownerId}>
        {(owner) => (
          <Row label="Owner">
            <UserChip userId={owner()} />
          </Row>
        )}
      </Show>
      <Show when={props.file.created}>
        <Row label="Created">{formatDateTime(props.file.created)}</Row>
      </Show>
      <Row label="Type">
        {[props.file.filetype?.toUpperCase(), formatSize(props.file.size)]
          .filter(Boolean)
          .join(" · ")}
      </Row>
      <Show when={props.detail?.viewerCount}>
        {(count) => (
          <Row label="Viewers">
            {count()} {count() === 1 ? "person" : "people"}
          </Row>
        )}
      </Show>
      <Show when={props.file.permalink}>
        {(link) => (
          <Row label="Link">
            <span class="file-detail-link flex-align-center">
              <span class="truncate">{link()}</span>
              <Button onClick={() => void copyLink(link())} size="sm">
                {copied() ? "Copied" : "Copy"}
              </Button>
            </span>
          </Row>
        )}
      </Show>
      <Show when={(props.detail?.access.users.length ?? 0) > 0}>
        <div class="file-detail-access">
          <div class="file-detail-section-label text-dim">People with access</div>
          <For each={props.detail?.access.users}>
            {(entry) => (
              <div class="file-detail-access-row flex-between">
                <UserChip userId={entry.userId} />
                <span class="text-dim">
                  {entry.userId === props.detail?.ownerId
                    ? LEVEL_LABELS.owner
                    : (LEVEL_LABELS[entry.access] ?? entry.access)}
                </span>
              </div>
            )}
          </For>
          <div class="file-detail-org-access text-dim">
            {ACCESS_LABELS[props.detail?.access.orgLevel ?? "none"] ?? ""}
          </div>
        </div>
      </Show>
    </div>
  );
}
