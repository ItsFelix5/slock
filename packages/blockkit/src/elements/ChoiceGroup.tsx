import type { CheckboxRadioElement } from "@slock/types";
import { For, Show } from "solid-js";
import BkText from "../BkText";
import { optionKey, optionPayload } from "./options";

export default function ChoiceGroup(props: {
  dispatch: (payload: Record<string, unknown>) => void;
  el: CheckboxRadioElement;
  name: string;
  ready: boolean;
}) {
  const multi = () => props.el.type === "checkboxes";
  const initial = () => {
    const options = multi()
      ? (props.el.initial_options ?? [])
      : props.el.initial_option
        ? [props.el.initial_option]
        : [];
    return new Set(options.map(optionKey));
  };

  const choose = (form: HTMLFormElement) => {
    const selected = new FormData(form)
      .getAll(props.name)
      .flatMap((index) => props.el.options[Number(index)] ?? []);
    props.dispatch(
      multi()
        ? { selected_options: selected.map(optionPayload) }
        : { selected_option: selected[0] ? optionPayload(selected[0]) : null },
    );
  };

  return (
    <form class="bk-options flex-col" onChange={(event) => choose(event.currentTarget)}>
      <For each={props.el.options}>
        {(option, index) => (
          <label class="bk-option flex-align-center">
            <input
              checked={initial().has(optionKey(option))}
              disabled={!props.ready}
              name={props.name}
              ref={(node) =>
                props.el.focus_on_load && index() === 0 && queueMicrotask(() => node.focus())
              }
              type={multi() ? "checkbox" : "radio"}
              value={String(index())}
            />
            <span class="flex-col">
              <BkText text={option.text} />
              <Show when={option.description}>
                <span class="meta-dim">
                  <BkText text={option.description} />
                </span>
              </Show>
            </span>
          </label>
        )}
      </For>
    </form>
  );
}
