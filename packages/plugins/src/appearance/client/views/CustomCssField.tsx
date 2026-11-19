import { setThemeCss, themeCss } from "@slock/ui";

export default function CustomCssField() {
  return (
    <div class="settings-section">
      <div class="settings-section-title">Custom CSS</div>
      <textarea
        aria-label="Custom CSS"
        class="settings-custom-css text-field"
        onInput={(e) => setThemeCss(e.currentTarget.value)}
        spellcheck={false}
        value={themeCss()}
      />
    </div>
  );
}
