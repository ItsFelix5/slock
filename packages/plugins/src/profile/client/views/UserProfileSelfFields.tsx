import type { ProfileForm } from "./profileForm";

export default function UserProfileSelfFields(props: { form: ProfileForm }) {
  const { form } = props;
  return (
    <div class="user-profile-edit-name flex-col">
      <input
        aria-label="Display name"
        class="user-profile-name-input"
        data-commit-on-enter
        disabled={form.isSavingField("name")}
        onBlur={() => form.commitSelfField("name")}
        onInput={(e) => form.setInput("name", e.currentTarget.value)}
        type="text"
        value={form.inputs.name}
      />
      <input
        aria-label="Full name"
        class="user-profile-pronouns-input"
        data-commit-on-enter
        disabled={form.isSavingField("fullName")}
        onBlur={() => form.commitSelfField("fullName")}
        onInput={(e) => form.setInput("fullName", e.currentTarget.value)}
        placeholder="Full name"
        type="text"
        value={form.inputs.fullName}
      />
      <textarea
        aria-label="Title"
        class="user-profile-title-input"
        data-commit-on-enter
        disabled={form.isSavingField("title")}
        onBlur={() => form.commitSelfField("title")}
        onInput={(e) => form.setInput("title", e.currentTarget.value)}
        placeholder="Title"
        value={form.inputs.title}
      />
      <input
        aria-label="Pronouns"
        class="user-profile-pronouns-input"
        data-commit-on-enter
        disabled={form.isSavingField("pronouns")}
        onBlur={() => form.commitSelfField("pronouns")}
        onInput={(e) => form.setInput("pronouns", e.currentTarget.value)}
        placeholder="Pronouns"
        type="text"
        value={form.inputs.pronouns}
      />
    </div>
  );
}
