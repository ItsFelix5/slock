import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { Icon, Menu, MenuItem, type ThemeFamily, type ThemePreset } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import "./ThemeFamilyChip.css";

const theme = service("theme");

const previewBorder = (preset: ThemePreset) =>
  `color-mix(in srgb, ${preset.colors.textPrimary} 25%, transparent)`;

const previewStyle = (preset: ThemePreset) => ({
  "--theme-preview-overlay": preset.colors.textPrimary,
  background: preset.colors.mainBg,
  "border-color": previewBorder(preset),
  color: preset.colors.textPrimary,
});

function Dot(props: { preset: ThemePreset }) {
  return (
    <span
      aria-hidden="true"
      class="settings-theme-preset-dot"
      style={{ background: props.preset.colors.accent }}
    />
  );
}

function Swatch(props: { preset: ThemePreset }) {
  return (
    <span
      aria-hidden="true"
      class="settings-theme-swatch"
      style={{
        background: `radial-gradient(circle, ${props.preset.colors.accent} 0 3px, ${props.preset.colors.mainBg} 3.5px)`,
        "border-color": previewBorder(props.preset),
      }}
    />
  );
}

export default function ThemeFamilyChip(props: { activeId: string; family: ThemeFamily }) {
  const [open, setOpen] = createSignal(false);
  const first = () => defined(props.family.presets[0]);
  const active = () => props.family.presets.find((preset) => preset.id === props.activeId);
  const shown = () => active() ?? first();
  const chipLabel = () => {
    const variant = active()?.label;
    if (!variant || props.family.label.endsWith(variant)) return props.family.label;
    return `${props.family.label} ${variant}`;
  };

  return (
    <Show
      fallback={
        <Menu
          onClose={() => setOpen(false)}
          open={open()}
          panelClass="menu-panel"
          trigger={
            <button
              class={[
                "settings-preset-btn",
                "settings-theme-preset-btn",
                "btn-reset",
                "flex-align-center",
                { active: Boolean(active()) },
              ]}
              onClick={() => setOpen(!open())}
              style={previewStyle(shown())}
              type="button"
            >
              <Dot preset={shown()} />
              {chipLabel()}
              <Icon name="caret-down" size={9} />
            </button>
          }
        >
          <For each={props.family.presets}>
            {(preset) => (
              <MenuItem
                leading={<Swatch preset={preset} />}
                onClick={() => {
                  theme.applyPreset(preset);
                  setOpen(false);
                }}
              >
                {preset.label}
                <Show when={preset.id === props.activeId}>
                  <Icon class="settings-theme-menu-check" name="check" size={13} />
                </Show>
              </MenuItem>
            )}
          </For>
        </Menu>
      }
      when={props.family.presets.length === 1}
    >
      <label
        class="settings-preset-btn settings-theme-preset-btn flex-align-center"
        style={previewStyle(first())}
      >
        <input
          checked={props.activeId === first().id}
          class="sr-input"
          name="theme-preset"
          onChange={() => theme.applyPreset(first())}
          type="radio"
          value={first().id}
        />
        <Dot preset={first()} />
        {first().label}
      </label>
    </Show>
  );
}
