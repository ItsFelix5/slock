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

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Theme</div>
          <div class="settings-row-hint">"System" follows your OS's light/dark setting.</div>
        </div>
        <SegmentedControl>
          <button
            type="button"
            class="segmented-control-btn"
            classList={{ active: theme() === "dark" }}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            class="segmented-control-btn"
            classList={{ active: theme() === "light" }}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            class="segmented-control-btn"
            classList={{ active: theme() === "system" }}
            onClick={() => setTheme("system")}
          >
            System
          </button>
        </SegmentedControl>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Compact messages</div>
          <div class="settings-row-hint">Tighter spacing between consecutive messages.</div>
        </div>
        <Switch checked={compactMode()} onChange={setCompactMode} title="Toggle compact mode" />
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Log deleted messages</div>
          <div class="settings-row-hint">
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
        <div class="settings-row-hint">Quick accent palettes. Fine-tune any of them below.</div>
        <div class="settings-preset-group">
          <For each={THEME_PRESETS}>
            {(preset) => (
              <button
                type="button"
                class="settings-preset-btn"
                classList={{ active: activePreset() === preset.id }}
                onClick={() => applyPreset(preset)}
                title={preset.label}
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
        <div class="settings-row-hint">
          Every color token used by the app. Type a hex/rgba value or click a swatch to pick one.
        </div>
        <div class="settings-color-list">
          <For each={THEME_COLOR_KEYS}>
            {(key) => (
              <ColorField
                label={THEME_COLOR_LABELS[key]}
                value={getEffectiveColor(key)}
                onChange={(v) => setThemeColors({ [key]: v })}
                onReset={() => resetThemeColor(key)}
              />
            )}
          </For>
        </div>
        <button type="button" class="settings-status-clear" onClick={() => resetThemeColors()}>
          Reset all colors
        </button>
      </div>
    </>
  );
}
