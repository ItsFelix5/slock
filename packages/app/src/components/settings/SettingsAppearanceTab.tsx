import { compactMode, setCompactMode, setTheme, theme } from "@slock/ui";
import "./SettingsTabs.css";

export default function SettingsAppearanceTab() {
  return (
    <>
      <h2>Appearance</h2>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Theme</div>
          <div class="settings-row-hint">"System" follows your OS's light/dark setting.</div>
        </div>
        <div class="settings-toggle-group">
          <button
            type="button"
            class="settings-toggle-btn"
            classList={{ active: theme() === "dark" }}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            class="settings-toggle-btn"
            classList={{ active: theme() === "light" }}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            class="settings-toggle-btn"
            classList={{ active: theme() === "system" }}
            onClick={() => setTheme("system")}
          >
            System
          </button>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Compact messages</div>
          <div class="settings-row-hint">Tighter spacing between consecutive messages.</div>
        </div>
        <button
          type="button"
          class="settings-switch"
          classList={{ on: compactMode() }}
          onClick={() => setCompactMode(!compactMode())}
          title="Toggle compact mode"
        >
          <span class="settings-switch-knob" />
        </button>
      </div>
    </>
  );
}
