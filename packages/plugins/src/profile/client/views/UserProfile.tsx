import { service } from "@slock/core/solid";
import { Button, InlineFeedback, type Pane, PanelHeader } from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { fetchProfileFieldDefs } from "../../../slack/client/api";
import type { ProfilePaneContent } from "../api";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import "./UserProfile.css";
import { defineKey } from "../../../query/client/api";
import UserProfileContact from "./UserProfileContact";
import UserProfileInfo from "./UserProfileInfo";
import { createProfileForm } from "./profileForm";
import { isCustomFieldDef } from "./userProfileFieldValues";
import { createLocalTime, createTzDiff, createTzSuffix } from "./userProfileTime";

const profileFieldDefsKey = defineKey<[]>("profileFieldDefs");

const feedback = service("feedback");

const query = service("query");
const viewStore = service("shell.view");
const usersStore = service("users");

export default function UserProfile(props: { pane: Pane<ProfilePaneContent> }) {
  const profileUserId = () => props.pane.content.userId;
  const profileFieldDefs = createQuery(
    () => ({ queryFn: fetchProfileFieldDefs, queryKey: profileFieldDefsKey() }),
    () => query.client,
  );
  const [photoToEdit, setPhotoToEdit] = createSignal<File>();
  const user = createMemo(() => {
    const base = usersStore.userById(profileUserId());
    if (!base) return base;
    const presence = base.isBot ? undefined : usersStore.presenceFor(base.id);
    return presence ? { ...base, presence } : base;
  });
  const isSelf = () => user()?.id === usersStore.currentUser()?.id;
  const botBio = () =>
    user()?.isBot ? usersStore.botBio(user()?.appId, user()?.botId) : undefined;
  const form = createProfileForm({
    fieldDefs: () => profileFieldDefs.data,
    user,
    userId: profileUserId,
  });
  const [now, setNow] = createSignal(Date.now());
  const clockTimer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clockTimer));
  const localTime = createLocalTime(user, now);
  const tzDiff = createTzDiff(user, now);
  const tzSuffix = createTzSuffix(user, tzDiff);
  const startDate = createMemo(() => {
    const u = user();
    return u?.startDate ?? (u ? usersStore.profileStartDateFor(u.id) : undefined);
  });
  const customFields = createMemo(() => {
    const defs = profileFieldDefs.data;
    const id = user()?.id;
    const values = id ? usersStore.customFieldsFor(id) : undefined;
    if (!(defs && values?.length)) return [];
    const definitionById = new Map(defs.map((d) => [d.id, d]));
    return values
      .map((f) => ({ ...f, definition: definitionById.get(f.id) }))
      .filter(
        (f): f is typeof f & { definition: { label: string; type?: string } } =>
          !!f.definition?.label && isCustomFieldDef(f.definition),
      )
      .map(({ definition, ...field }) => ({
        ...field,
        label: definition.label,
        type: definition.type,
      }));
  });
  const editableCustomFields = createMemo(() =>
    (profileFieldDefs.data ?? []).filter(isCustomFieldDef),
  );
  return (
    <>
      <div class="user-profile-panel flex-col" data-pane={props.pane.id}>
        <PanelHeader
          canClose={viewStore.canCloseTile()}
          onClose={() => viewStore.closeTile(props.pane.id)}
          title="Profile"
        />
        <Show
          fallback={
            <div class="user-profile-body text-muted">
              {usersStore.isUnresolvableUser(profileUserId())
                ? "Profile unavailable"
                : "Loading profile…"}
            </div>
          }
          when={user()}
        >
          {(u) => (
            <div class="user-profile-body">
              <InlineFeedback
                class="user-profile-feedback truncate"
                feedback={feedback.get(isSelf() ? "me" : u().id)}
                priority={2}
              />
              <UserProfileInfo
                botBio={botBio()}
                form={form}
                isSelf={isSelf()}
                localTime={localTime()}
                onPhotoSelected={setPhotoToEdit}
                tzSuffix={tzSuffix()}
                user={u()}
              />
              <UserProfileContact
                customFields={customFields()}
                editableFields={editableCustomFields()}
                form={form}
                isSelf={isSelf()}
                startDate={startDate()}
                user={u()}
              />
              <Show when={profileFieldDefs.error}>
                <div class="user-profile-fields-warning flex-between">
                  <span>Additional profile fields are unavailable.</span>
                  <Button
                    disabled={profileFieldDefs.isFetching}
                    onClick={() => void profileFieldDefs.refetch()}
                    size="sm"
                  >
                    {profileFieldDefs.isFetching ? "Retrying…" : "Try again"}
                  </Button>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </div>
      <Show when={photoToEdit()}>
        {(file) => (
          <ProfilePhotoEditor
            file={file()}
            onClose={() => setPhotoToEdit(undefined)}
            onSave={form.updatePhoto}
          />
        )}
      </Show>
    </>
  );
}
