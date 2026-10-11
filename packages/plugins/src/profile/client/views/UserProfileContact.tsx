import type { ProfileFieldDef, User } from "@slock/types";
import { createCopyFeedback, IconButton } from "@slock/ui";
import { For, Show } from "solid-js";
import UserProfileFieldValue from "./UserProfileFieldValue";
import { formatStartDate } from "./userProfileTime";
import "./UserProfileContact.css";

type CustomField = { label: string; value: string; alt?: string; type?: string };
export default function UserProfileContact(props: {
  user: User;
  isSelf: boolean;
  startDate: string | undefined;
  customFields: CustomField[];
  editableFields: ProfileFieldDef[];
  values: Record<string, string>;
  isSavingField: (id: string) => boolean;
  setValue: (id: string, value: string) => void;
  saveField: (id: string) => void;
}) {
  const [copiedKey, copy] = createCopyFeedback();
  return (
    <div class="user-profile-section">
      <h3 class="user-profile-section-title">Contact information</h3>
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
      <Show when={formatStartDate(props.startDate)}>
        <div class="user-profile-field">
          <div class="user-profile-field-label text-muted">Start date</div>
          <div class="user-profile-field-value">{formatStartDate(props.startDate)}</div>
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
                  data-commit-on-enter
                  type={field.type === "date" ? "date" : "text"}
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
              <UserProfileFieldValue alt={field.alt} type={field.type} value={field.value} />
            </div>
          )}
        </For>
      </Show>
      <For
        each={[
          {
            label: "User ID",
            value: props.user.id === props.user.botId ? undefined : props.user.id,
          },
          { label: "Bot ID", value: props.user.botId },
          { label: "App ID", value: props.user.appId },
        ]}
      >
        {(entry) => (
          <Show when={entry.value}>
            {(value) => (
              <div class="user-profile-field">
                <div class="user-profile-field-label text-muted">{entry.label}</div>
                <div class="user-profile-copyable-value flex-align-center gap-xs">
                  <code class="user-profile-field-value truncate">{value()}</code>
                  <IconButton
                    class="user-profile-copy-btn"
                    icon={copiedKey() === value() ? "check" : "copy"}
                    iconSize={15}
                    label={copiedKey() === value() ? "Copied" : `Copy ${entry.label}`}
                    onClick={() => void copy(value(), value())}
                    size="sm"
                  />
                </div>
              </div>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}
