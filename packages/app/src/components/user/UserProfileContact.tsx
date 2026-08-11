// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to contact formatting.
import type { ProfileFieldDef, User } from "@slock/slack-api";
import { createCopyFeedback, Icon, Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import "./UserProfileContact.css";

type CustomField = { label: string; value: string; alt?: string };
export default function UserProfileContact(props: {
  user: User;
  isSelf: boolean;
  customFields: CustomField[];
  editableFields: ProfileFieldDef[];
  values: Record<string, string>;
  isSavingField: (id: string) => boolean;
  setValue: (id: string, value: string) => void;
  saveField: (id: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const [copiedKey, copy] = createCopyFeedback();
  return (
    <div class="user-profile-section">
      <h3 class="user-profile-section-title">Contact information</h3>
      <div class="user-profile-field">
        <div class="user-profile-field-label text-muted">User ID</div>
        <div class="user-profile-copyable-value">
          <code class="user-profile-field-value">{props.user.id}</code>
          <Tooltip content={copiedKey() === props.user.id ? "Copied" : "Copy user ID"}>
            <button
              aria-label="Copy user ID"
              class="user-profile-copy-btn btn-reset flex-center"
              onClick={() => void copy(props.user.id, props.user.id)}
              type="button"
            >
              <Icon name={copiedKey() === props.user.id ? "check" : "copy"} size={15} />
            </button>
          </Tooltip>
        </div>
      </div>
      <Show when={props.user.email}>
        <div class="user-profile-field">
          <div class="user-profile-field-label text-muted">Email</div>
          <a
            class="user-profile-field-value user-profile-field-link"
            href={`mailto:${props.user.email}`}
          >
            {props.user.email}
          </a>
        </div>
      </Show>
      <Show when={props.user.phone}>
        <div class="user-profile-field">
          <div class="user-profile-field-label text-muted">Phone</div>
          <div class="user-profile-field-value">{props.user.phone}</div>
        </div>
      </Show>
      <Show
        fallback={
          <For each={props.editableFields}>
            {(field) => (
              <div class="user-profile-field">
                <label
                  class="user-profile-field-label text-muted"
                  for={`profile-field-${field.id}`}
                >
                  {field.label}
                </label>
                <input
                  class="user-profile-field-input"
                  disabled={props.isSavingField(field.id)}
                  id={`profile-field-${field.id}`}
                  onBlur={() => props.saveField(field.id)}
                  onInput={(event) => props.setValue(field.id, event.currentTarget.value)}
                  onKeyDown={props.onKeyDown}
                  type="text"
                  value={props.values[field.id] ?? ""}
                />
              </div>
            )}
          </For>
        }
        when={!props.isSelf}
      >
        <For each={props.customFields}>
          {(field) => (
            <div class="user-profile-field">
              <div class="user-profile-field-label text-muted">{field.label}</div>
              <Show
                fallback={<div class="user-profile-field-value">{field.alt || field.value}</div>}
                when={/^https?:\/\//.test(field.value)}
              >
                <a
                  class="user-profile-field-value user-profile-field-link"
                  href={field.value}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {field.alt || field.value}
                </a>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
