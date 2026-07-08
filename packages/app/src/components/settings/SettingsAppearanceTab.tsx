import {
  activePreset,
  applyPreset,
  compactMode,
  getEffectiveColor,
  resetThemeColor,
  resetThemeColors,
  setCompactMode,
  setTheme,
  setThemeColors,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  type ThemeColors,
  theme,
} from "@slock/ui";
import { createEffect, createSignal, For } from "solid-js";
import "./Settings.css";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function ColorRow(props: { colorKey: Exclude<keyof ThemeColors, "font"> }) {
  const value = () => getEffectiveColor(props.colorKey);
  const [draft, setDraft] = createSignal(value());

  createEffect(() => setDraft(value()));

  function commit(next: string) {
    if (!next || !CSS.supports("color", next)) return;
    setThemeColors({ [props.colorKey]: next });
  }

  return (
    <div class="settings-color-row">
      <div class="settings-color-swatch" style={{ "background-color": value() }}>
        {HEX_RE.test(value()) && (
          <input
            type="color"
            class="settings-color-native"
            value={value()}
            onInput={(e) => commit(e.currentTarget.value)}
            title="Pick a color"
          />
        )}
      </div>
      <div class="settings-color-name">{THEME_COLOR_LABELS[props.colorKey]}</div>
      <input
        type="text"
        class="settings-color-text"
        value={draft()}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => commit(e.currentTarget.value.trim())}
        spellcheck={false}
      />
      <button
        type="button"
        class="settings-color-reset"
        onClick={() => resetThemeColor(props.colorKey)}
        title="Reset to default"
      >
        ↺
      </button>
    </div>
  );
}

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
          <For each={THEME_COLOR_KEYS}>{(key) => <ColorRow colorKey={key} />}</For>
        </div>
        <button type="button" class="settings-status-clear" onClick={() => resetThemeColors()}>
          Reset all colors
        </button>
      </div>
    </>
  );
}
