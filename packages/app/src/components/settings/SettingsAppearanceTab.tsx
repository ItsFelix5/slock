import {
  activePreset,
  applyPreset,
  ColorField,
  compactMode,
  getEffectiveColor,
  logDeletedMessages,
  resetThemeColor,
  resetThemeColors,
  SegmentedControl,
  Switch,
  setCompactMode,
  setLogDeletedMessages,
  setTheme,
  setThemeColors,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  theme,
} from "@slock/ui";
import { For } from "solid-js";
import "./Settings.css";

export default function SettingsAppearanceTab() {
  return (
    <>
      <h2>Appearance</h2>

      <div class="settings-row flex-between">
        <div>
          <div class="settings-row-label">Theme</div>
          <div class="settings-row-hint text-dim">
            "System" follows your OS's light/dark setting.
          </div>
        </div>
        <SegmentedControl>
          <button
            class="segmented-control-btn"
            classList={{ active: theme() === "dark" }}
            onClick={() => setTheme("dark")}
            type="button"
          >
            Dark
          </button>
          <button
            class="segmented-control-btn"
            classList={{ active: theme() === "light" }}
            onClick={() => setTheme("light")}
            type="button"
          >
            Light
          </button>
          <button
            class="segmented-control-btn"
            classList={{ active: theme() === "system" }}
            onClick={() => setTheme("system")}
            type="button"
          >
            System
          </button>
        </SegmentedControl>
      </div>

      <div class="settings-row flex-between">
        <div>
          <div class="settings-row-label">Compact messages</div>
          <div class="settings-row-hint text-dim">
            Tighter spacing between consecutive messages.
          </div>
        </div>
        <Switch checked={compactMode()} onChange={setCompactMode} title="Toggle compact mode" />
      </div>

      <div class="settings-row flex-between">
        <div>
          <div class="settings-row-label">Log deleted messages</div>
          <div class="settings-row-hint text-dim">
            Keep a deleted message visible, struck through, instead of removing it from the list.
          </div>
        </div>
        <Switch
          checked={logDeletedMessages()}
          onChange={setLogDeletedMessages}
          title="Toggle logging deleted messages"
        />
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Color preset</div>
        <div class="settings-row-hint text-dim">
          Quick accent palettes. Fine-tune any of them below.
        </div>
        <div class="settings-preset-group">
          <For each={THEME_PRESETS}>
            {(preset) => (
              <button
                class="settings-preset-btn btn-reset flex-align-center"
                classList={{ active: activePreset() === preset.id }}
                onClick={() => applyPreset(preset)}
                title={preset.label}
                type="button"
              >
                <span
                  class="settings-preset-swatch"
                  style={{ "background-color": preset.colors.accent }}
                />
                {preset.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Custom colors</div>
        <div class="settings-row-hint text-dim">
          Every color token used by the app. Type a hex/rgba value or click a swatch to pick one.
        </div>
        <div class="settings-color-list">
          <For each={THEME_COLOR_KEYS}>
            {(key) => (
              <ColorField
                label={THEME_COLOR_LABELS[key]}
                onChange={(v) => setThemeColors({ [key]: v })}
                onReset={() => resetThemeColor(key)}
                value={getEffectiveColor(key)}
              />
            )}
          </For>
        </div>
        <button
          class="settings-status-clear btn-reset"
          onClick={() => resetThemeColors()}
          type="button"
        >
          Reset all colors
        </button>
      </div>
    </>
  );
}
