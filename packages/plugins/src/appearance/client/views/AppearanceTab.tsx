import { service } from "@slock/core/solid";
import {
  activeFontPreset,
  ariaBoolean,
  ColorField,
  type ColorRef,
  createCopyFeedback,
  FONT_PRESETS,
  Icon,
  IconButton,
  Slider,
  THEME_FAMILIES,
  type ThemeColorDefinition,
} from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./AppearanceTab.css";
import CustomCssField from "./CustomCssField";
import ThemeFamilyChip from "./ThemeFamilyChip";

const theme = service("theme");

function ThemeColorField(props: { color: ThemeColorDefinition }) {
  const key = () => props.color.key;
  const relative = () => {
    const reference = theme.getColorRef(key());
    return (
      reference && {
        onChange: (ref: ColorRef) => theme.setColorRef(key(), ref),
        onDecouple: () => theme.decoupleThemeColor(key()),
        reference,
      }
    );
  };
  return (
    <ColorField
      displayValue={theme.getColorFormula(key())}
      isCustom={theme.isThemeColorCustom(key())}
      label={props.color.label}
      onChange={(value) => theme.setThemeColors({ [key()]: value })}
      onReset={() => theme.resetThemeColor(key())}
      relative={relative()}
      value={theme.getEffectiveColor(key())}
    />
  );
}

export default function AppearanceTab() {
  const [fontDraft, setFontDraft] = createSignal(() => theme.font());
  const [copiedKey, copy] = createCopyFeedback();
  const [pasteResult, setPasteResult] = createSignal<"pasted" | "failed" | null>(null);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  const activeThemeId = createMemo(theme.activePreset);

  async function copyTheme() {
    await copy(theme.copyableThemePalette(), "theme");
  }

  async function pasteTheme() {
    try {
      const payload = await navigator.clipboard.readText();
      setPasteResult(theme.applyCopiedThemePalette(payload) ? "pasted" : "failed");
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
          onChange={(value) => theme.setThemeShape({ density: value })}
          value={theme.themeShape().density}
        />
      </div>

      <div class="settings-row flex-between">
        <div class="settings-row-label">Roundness</div>
        <Slider
          ariaLabel="Roundness"
          labels={["Sharp", "Default", "Round"]}
          max={2}
          min={0}
          onChange={(value) => theme.setThemeShape({ roundness: value })}
          value={theme.themeShape().roundness}
        />
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Font</div>
        <div class="settings-preset-group">
          <For each={FONT_PRESETS}>
            {(preset) => (
              <label
                class="settings-preset-btn flex-align-center"
                style={{ "font-family": preset.value }}
              >
                <input
                  checked={activeFontPreset(theme.font()) === preset.id}
                  class="sr-input"
                  name="font-preset"
                  onChange={() => theme.setFont(preset.value)}
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
            class="settings-status-input text-field"
            onChange={(e) => theme.setFont(e.currentTarget.value)}
            onInput={(e) => setFontDraft(e.currentTarget.value)}
            spellcheck={false}
            style={{ "font-family": fontDraft() }}
            type="text"
            value={fontDraft()}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Theme</div>
        <div class="settings-preset-group">
          <For each={THEME_FAMILIES}>
            {(family) => <ThemeFamilyChip activeId={activeThemeId()} family={family} />}
          </For>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title flex-between">
          Custom colors
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
          <For each={theme.themeColorDefinitions().filter((color) => !color.derive)}>
            {(color) => <ThemeColorField color={color} />}
          </For>
        </div>

        <button
          aria-expanded={ariaBoolean(advancedOpen())}
          class="settings-advanced-toggle btn-reset flex-align-center"
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <Icon name={advancedOpen() ? "caret-down-filled" : "caret-right-filled"} size={12} />
          Advanced
        </button>
        <Show when={advancedOpen()}>
          <div class="settings-color-list">
            <For each={theme.themeColorDefinitions().filter((color) => color.derive)}>
              {(color) => <ThemeColorField color={color} />}
            </For>
          </div>
        </Show>
      </div>

      <CustomCssField />
    </>
  );
}
