import { service } from "@slock/core/solid";
import type { User } from "@slock/types";
import { AvatarImage, ariaBoolean } from "@slock/ui";
import { dynamic } from "@solidjs/web";
import { createSignal, onSettled, Show } from "solid-js";
import type { ProfileForm } from "./profileForm";

const TEXT_INPUT_TAG_RE = /^(INPUT|TEXTAREA)$/;

const usersStore = service("users");

export default function UserProfileAvatar(props: {
  form: ProfileForm;
  isSelf: boolean;
  onPhotoSelected: (file: File) => void;
  user: User;
}) {
  const [photoInput, setPhotoInput] = createSignal<HTMLInputElement>();
  const saving = () => usersStore.isSavingPhoto();
  const Wrap = dynamic(() => (props.isSelf ? "button" : "div"));

  onSettled(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (!props.isSelf || saving()) return;
      const { target } = event;
      if (target instanceof HTMLElement && TEXT_INPUT_TAG_RE.test(target.tagName)) return;
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) props.onPhotoSelected(file);
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  });

  const photoLabel = () => {
    if (saving()) return "Uploading profile photo";
    return "Change profile photo";
  };

  return (
    <div class="user-profile-avatar-wrap">
      <Wrap
        aria-busy={props.isSelf ? ariaBoolean(saving()) : undefined}
        aria-label={props.isSelf ? photoLabel() : undefined}
        class={["user-profile-avatar flex-center", { "is-editable": props.isSelf }]}
        disabled={props.isSelf ? saving() : undefined}
        onClick={() => {
          if (!saving()) photoInput()?.click();
        }}
        style={{ background: props.user.avatarColor }}
        type={props.isSelf ? "button" : undefined}
      >
        <AvatarImage avatarUrl={props.user.avatarUrl} />
        <Show when={props.isSelf}>
          <input
            accept="image/*"
            class="user-profile-photo-input"
            disabled={saving()}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) props.onPhotoSelected(file);
              event.currentTarget.value = "";
            }}
            ref={setPhotoInput}
            type="file"
          />
        </Show>
      </Wrap>
      <Show when={props.isSelf}>
        <button
          aria-busy={ariaBoolean(usersStore.isSavingPresence())}
          aria-label={
            usersStore.isSavingPresence()
              ? "Updating presence"
              : props.user.presence === "away"
                ? "Set yourself active"
                : "Set yourself away"
          }
          class={["user-profile-presence busy", { away: props.user.presence === "away" }]}
          disabled={usersStore.isSavingPresence()}
          onClick={(event) => {
            event.stopPropagation();
            void props.form.togglePresence();
          }}
          type="button"
        />
      </Show>
      <Show when={!props.isSelf && props.user.presence}>
        <span
          aria-label={`${props.user.name} is ${props.user.presence}`}
          class={["user-profile-presence busy", { away: props.user.presence === "away" }]}
        />
      </Show>
    </div>
  );
}
