import {
  activePreset,
  applyPreset,
  ColorField,
  getEffectiveColor,
  logDeletedMessages,
  type MessageSize,
  messageSize,
  resetThemeColor,
  resetThemeColors,
  Switch,
  setLogDeletedMessages,
  setMessageSize,
  setThemeColors,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  Tooltip,
} from "@slock/ui";
import { For } from "solid-js";
import "./Settings.css";

export default function SettingsAppearanceTab() {
  return (
    <>
      <h2>Appearance</h2>

      <div class="settings-row flex-between">
        <div>
          <div class="settings-row-label">Message size</div>
          <div class="settings-row-hint text-dim">Compact, default, or large messages.</div>
        </div>
        <div class="settings-size-control">
          <input
            aria-label="Message size"
            class="settings-size-slider"
            max="2"
            min="0"
            onInput={(event) => setMessageSize(Number(event.currentTarget.value) as MessageSize)}
            step="1"
            type="range"
            value={messageSize()}
          />
          <div class="settings-size-labels text-dim" aria-hidden="true">
            <span>Compact</span>
            <span>Default</span>
            <span>Large</span>
          </div>
        </div>
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
        <div class="settings-row-label">Theme</div>
        <div class="settings-row-hint text-dim">
          Choose a complete theme, then fine-tune any color below.
        </div>
        <div class="settings-preset-group">
          <For each={THEME_PRESETS}>
            {(preset) => (
              <Tooltip content={preset.label}>
                <button
                  aria-label={preset.label}
                  class="settings-preset-btn btn-reset flex-align-center"
                  classList={{ active: activePreset() === preset.id }}
                  onClick={() => applyPreset(preset)}
                  type="button"
                >
                  <span
                    class="settings-preset-swatch"
                    style={{
                      "background-color": preset.colors.mainBg,
                      "border-color": preset.colors.borderStrong,
                      color: preset.colors.accent,
                    }}
                  />
                  {preset.label}
                </button>
              </Tooltip>
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
