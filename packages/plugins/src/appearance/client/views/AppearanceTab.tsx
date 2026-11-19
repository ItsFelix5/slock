import {
  activeFontPreset,
  activePreset,
  applyCopiedThemePalette,
  ColorField,
  type ColorRef,
  copyableThemePalette,
  createCopyFeedback,
  decoupleThemeColor,
  FONT_PRESETS,
  font,
  getColorFormula,
  getColorRef,
  getEffectiveColor,
  Icon,
  IconButton,
  isThemeColorCustom,
  resetThemeColor,
  Slider,
  setColorRef,
  setFont,
  setThemeColors,
  setThemeShape,
  THEME_FAMILIES,
  type ThemeColorDefinition,
  themeColorDefinitions,
  themeShape,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import "./AppearanceTab.css";
import CustomCssField from "./CustomCssField";
import ThemeFamilyChip from "./ThemeFamilyChip";

function ThemeColorField(props: { color: ThemeColorDefinition }) {
  const key = () => props.color.key;
  const relative = () => {
    const reference = getColorRef(key());
    return (
      reference && {
        onChange: (ref: ColorRef) => setColorRef(key(), ref),
        onDecouple: () => decoupleThemeColor(key()),
        reference,
      }
    );
  };
  return (
    <ColorField
      displayValue={getColorFormula(key())}
      isCustom={isThemeColorCustom(key())}
      label={props.color.label}
      onChange={(value) => setThemeColors({ [key()]: value })}
      onReset={() => resetThemeColor(key())}
      relative={relative()}
      value={getEffectiveColor(key())}
    />
  );
}

export default function AppearanceTab() {
  const [fontDraft, setFontDraft] = createSignal(font());
  const [copiedKey, copy] = createCopyFeedback();
  const [pasteResult, setPasteResult] = createSignal<"pasted" | "failed" | null>(null);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  const activeThemeId = createMemo(activePreset);
  createEffect(() => setFontDraft(font()));

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
            class="settings-status-input text-field"
            onChange={(e) => setFont(e.currentTarget.value)}
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
          <For each={themeColorDefinitions().filter((color) => !color.derive)}>
            {(color) => <ThemeColorField color={color} />}
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
            <For each={themeColorDefinitions().filter((color) => color.derive)}>
              {(color) => <ThemeColorField color={color} />}
            </For>
          </div>
        </Show>
      </div>

      <CustomCssField />
    </>
  );
}
