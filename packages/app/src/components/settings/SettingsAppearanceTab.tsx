import {
  activeFontPreset,
  activePreset,
  applyCopiedThemePalette,
  applyPreset,
  ColorField,
  copyableThemePalette,
  createCopyFeedback,
  effectiveFont,
  FONT_PRESETS,
  getColorFormula,
  getEffectiveColor,
  Icon,
  IconButton,
  logDeletedMessages,
  resetThemeColor,
  Slider,
  Switch,
  setFont,
  setLogDeletedMessages,
  setShowUserStatuses,
  setThemeColors,
  setThemeShape,
  showUserStatuses,
  THEME_ADVANCED_COLOR_KEYS,
  THEME_BASE_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  themeShape,
} from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import "./Settings.css";
import "./SettingsAppearanceTab.css";

export default function SettingsAppearanceTab() {
  const [fontDraft, setFontDraft] = createSignal(effectiveFont());
  const [copiedKey, copy] = createCopyFeedback();
  const [pasteResult, setPasteResult] = createSignal<"pasted" | "failed" | null>(null);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  createEffect(() => setFontDraft(effectiveFont()));

  function commitFont(value: string) {
    setFont(value.trim());
  }

  async function copyTheme() {
    await copy(copyableThemePalette(), "theme");
  }

  async function pasteTheme() {
    try {
      const payload = await navigator.clipboard.readText();
      setPasteResult(applyCopiedThemePalette(payload) ? "pasted" : "failed");
    } catch {
      setPasteResult("failed");
    }
  }

  return (
    <>
      <h2>Appearance</h2>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Density</div>
        <Slider
          ariaLabel="Density"
          labels={["Compact", "Default", "Spacious"]}
          max={2}
          min={0}
          onChange={(value) => setThemeShape({ density: value })}
          value={themeShape().density}
        />
      </div>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Roundness</div>
        <Slider
          ariaLabel="Roundness"
          labels={["Sharp", "Default", "Round"]}
          max={2}
          min={0}
          onChange={(value) => setThemeShape({ roundness: value })}
          value={themeShape().roundness}
        />
      </div>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Log deleted messages</div>
        <Switch checked={logDeletedMessages()} onChange={setLogDeletedMessages} />
      </div>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Show user statuses</div>
        <Switch checked={showUserStatuses()} onChange={setShowUserStatuses} />
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Font</div>
        <div class="settings-preset-group">
          <For each={FONT_PRESETS}>
            {(preset) => (
              <label
                class="settings-preset-btn flex-align-center"
                style={{ "font-family": preset.value }}
              >
                <input
                  checked={activeFontPreset() === preset.id}
                  class="sr-input"
                  name="font-preset"
                  onChange={() => setFont(preset.value)}
                  type="radio"
                  value={preset.id}
                />
                {preset.label}
              </label>
            )}
          </For>
        </div>
        <div class="settings-font-custom flex-align-center">
          <input
            aria-label="Custom font"
            class="settings-status-input"
            onChange={(e) => commitFont(e.currentTarget.value)}
            onInput={(e) => setFontDraft(e.currentTarget.value)}
            spellcheck={false}
            style={{ "font-family": fontDraft() }}
            type="text"
            value={fontDraft()}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Theme</div>
        <div class="settings-preset-group">
          <For each={THEME_PRESETS}>
            {(preset) => (
              <label
                class="settings-preset-btn settings-theme-preset-btn flex-align-center"
                style={{
                  "--theme-preview-overlay": preset.colors.textPrimary,
                  background: preset.colors.mainBg,
                  "border-color": preset.colors.borderStrong ?? preset.colors.border,
                  color: preset.colors.textPrimary,
                }}
              >
                <input
                  checked={activePreset() === preset.id}
                  class="sr-input"
                  name="theme-preset"
                  onChange={() => applyPreset(preset)}
                  type="radio"
                  value={preset.id}
                />
                <span
                  aria-hidden="true"
                  class="settings-theme-preset-dot"
                  style={{ background: preset.colors.accent }}
                />
                {preset.label}
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row flex-between">
          <div class="settings-row-label">Custom colors</div>
          <div class="settings-theme-actions flex-align-center">
            <IconButton
              icon={pasteResult() === "pasted" ? "check" : "arrow-down"}
              label={pasteResult() === "failed" ? "Invalid theme" : "Paste theme"}
              onClick={pasteTheme}
              size="sm"
            />
            <IconButton
              icon={copiedKey() === "theme" ? "check" : "copy"}
              label={copiedKey() === "theme" ? "Copied" : "Copy theme"}
              onClick={copyTheme}
              size="sm"
            />
          </div>
        </div>
        <div class="settings-color-list">
          <For each={THEME_BASE_COLOR_KEYS}>
            {(key) => (
              <ColorField
                displayValue={getColorFormula(key)}
                label={THEME_COLOR_LABELS[key]}
                onChange={(v) => setThemeColors({ [key]: v })}
                onReset={() => resetThemeColor(key)}
                value={getEffectiveColor(key)}
              />
            )}
          </For>
        </div>

        <button
          aria-expanded={advancedOpen()}
          class="settings-advanced-toggle btn-reset flex-align-center"
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <Icon name={advancedOpen() ? "caret-down-filled" : "caret-right-filled"} size={12} />
          Advanced
        </button>
        <Show when={advancedOpen()}>
          <div class="settings-color-list">
            <For each={THEME_ADVANCED_COLOR_KEYS}>
              {(key) => (
                <ColorField
                  displayValue={getColorFormula(key)}
                  label={THEME_COLOR_LABELS[key]}
                  onChange={(v) => setThemeColors({ [key]: v })}
                  onReset={() => resetThemeColor(key)}
                  value={getEffectiveColor(key)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
