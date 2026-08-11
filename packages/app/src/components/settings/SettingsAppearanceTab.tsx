import {
  activeFontPreset,
  activePreset,
  applyCopiedThemePalette,
  applyPreset,
  ColorField,
  copyableThemePalette,
  createCopyFeedback,
  DEFAULT_FONT,
  FONT_PRESETS,
  getEffectiveColor,
  IconButton,
  logDeletedMessages,
  messageSize,
  resetThemeColor,
  Slider,
  Switch,
  setLogDeletedMessages,
  setMessageSize,
  setThemeColors,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  Tooltip,
} from "@slock/ui";
import { createEffect, createSignal, For } from "solid-js";
import "./Settings.css";

const MESSAGE_SIZE_LABELS = ["Compact", "Default", "Large"];

export default function SettingsAppearanceTab() {
  const [fontDraft, setFontDraft] = createSignal(getEffectiveColor("font"));
  const [copiedKey, copy] = createCopyFeedback();
  const [pasteResult, setPasteResult] = createSignal<"pasted" | "failed" | null>(null);
  createEffect(() => setFontDraft(getEffectiveColor("font")));

  function commitFont(value: string) {
    const trimmed = value.trim();
    setThemeColors({ font: trimmed || DEFAULT_FONT });
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
        <div class="settings-row-label">Message size</div>
        <Slider
          ariaLabel="Message size"
          labels={MESSAGE_SIZE_LABELS}
          max={2}
          min={0}
          onChange={setMessageSize}
          value={messageSize()}
        />
      </div>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Log deleted messages</div>
        <Switch
          checked={logDeletedMessages()}
          onChange={setLogDeletedMessages}
          title="Log deleted messages"
        />
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Font</div>
        <div class="settings-preset-group">
          <For each={FONT_PRESETS}>
            {(preset) => (
              <Tooltip content={preset.label}>
                <button
                  aria-label={preset.label}
                  class="settings-preset-btn btn-reset flex-align-center"
                  classList={{ active: activeFontPreset() === preset.id }}
                  onClick={() => setThemeColors({ font: preset.value })}
                  style={{ "font-family": preset.value }}
                  type="button"
                >
                  {preset.label}
                </button>
              </Tooltip>
            )}
          </For>
        </div>
        <div class="settings-font-custom flex-align-center">
          <input
            aria-label="Custom font"
            class="settings-status-input"
            onChange={(e) => commitFont(e.currentTarget.value)}
            onInput={(e) => setFontDraft(e.currentTarget.value)}
            placeholder={DEFAULT_FONT}
            spellcheck={false}
            style={{ "font-family": fontDraft() }}
            type="text"
            value={fontDraft()}
          />
          <Tooltip content="Reset to default">
            <button
              aria-label="Reset font to default"
              class="settings-status-clear btn-reset"
              onClick={() => resetThemeColor("font")}
              type="button"
            >
              Reset
            </button>
          </Tooltip>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Theme</div>
        <div class="settings-preset-group">
          <For each={THEME_PRESETS}>
            {(preset) => (
              <button
                aria-label={preset.label}
                class="settings-preset-btn settings-theme-preset-btn btn-reset flex-align-center"
                classList={{ active: activePreset() === preset.id }}
                onClick={() => applyPreset(preset)}
                style={{
                  "--theme-preview-overlay": preset.colors.textPrimary,
                  background: preset.colors.mainBg,
                  "border-color": preset.colors.borderStrong ?? preset.colors.border,
                  color: preset.colors.textPrimary,
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  class="settings-theme-preset-dot"
                  style={{ background: preset.colors.accent }}
                />
                {preset.label}
              </button>
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
      </div>
    </>
  );
}
