import { service } from "@slock/core/solid";

const theme = service("theme");

export default function CustomCssField() {
  return (
    <div class="settings-section">
      <div class="settings-section-title">Custom CSS</div>
      <textarea
        aria-label="Custom CSS"
        class="settings-custom-css text-field"
        onInput={(e) => theme.setThemeCss(e.currentTarget.value)}
        spellcheck={false}
        value={theme.themeCss()}
      />
    </div>
  );
}
