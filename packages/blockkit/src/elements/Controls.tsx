import { type BlockElement, runBlockAction, type TextObject } from "@slock/types";
import { createSignal, For, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";

type Option = { text: TextObject; value?: string };
type ElementData = {
  accessibility_label?: string;
  action_id?: string;
  icon?: string;
  initial_date?: string;
  initial_datetime?: number;
  initial_value?: string;
  negative_button?: { text: TextObject; value?: string };
  initial_option?: Option;
  initial_options?: Option[];
  initial_time?: string;
  max_files?: number;
  multiline?: boolean;
  options?: Option[];
  option_groups?: { label: TextObject; options: Option[] }[];
  placeholder?: TextObject;
  positive_button?: { text: TextObject; value?: string };
  text?: TextObject;
  type: string;
  url?: string;
  value?: string;
  workflow?: { trigger?: { url?: string } };
};

function allOptions(el: ElementData) {
  return [...(el.options ?? []), ...(el.option_groups ?? []).flatMap((group) => group.options)];
}

function optionPayload(option: Option) {
  return { text: option.text, ...(option.value === undefined ? {} : { value: option.value }) };
}

export default function Controls(props: {
  blockId?: string;
  context?: BlockActionContext;
  el: BlockElement;
}) {
  const el = () => props.el as unknown as ElementData;
  const [pending, setPending] = createSignal(false);

  const dispatch = (payload: Record<string, unknown>) => {
    const ctx = props.context;
    if (!(ctx?.botId && el().action_id) || pending()) {
      return;
    }
    setPending(true);
    runBlockAction({
      action: { action_id: el().action_id, block_id: props.blockId, type: el().type, ...payload },
      botId: ctx.botId,
      channelId: ctx.channelId,
      messageTs: ctx.messageTs,
    })
      .catch(() => undefined)
      .finally(() => setPending(false));
  };

  const selectOptions = () => allOptions(el());
  const isMulti = () => el().type.startsWith("multi_") || el().type === "checkboxes";
  const initialValues = () =>
    (el().initial_options ?? []).map((option) => option.value ?? option.text.text);
  const initialValue = () => el().initial_option?.value ?? el().initial_option?.text.text ?? "";
  const placeholder = () => el().placeholder?.text ?? "Select an option";

  const select = (target: HTMLSelectElement) => {
    const options = selectOptions();
    const selected = [...target.selectedOptions]
      .map((item) => options[Number(item.value)])
      .filter((option): option is Option => !!option);
    dispatch(
      isMulti()
        ? { selected_options: selected.map(optionPayload) }
        : { selected_option: selected[0] ? optionPayload(selected[0]) : null },
    );
  };

  const choose = (target: HTMLFormElement) => {
    const options = selectOptions();
    const selected = options.filter((_, index) => {
      const input = target.elements.namedItem(`bk-${props.blockId}-${el().action_id}-${index}`);
      return input instanceof HTMLInputElement && input.checked;
    });
    dispatch(
      el().type === "checkboxes"
        ? { selected_options: selected.map(optionPayload) }
        : { selected_option: selected[0] ? optionPayload(selected[0]) : null },
    );
  };

  if (el().type === "workflow_button") {
    const url = el().workflow?.trigger?.url ?? el().url;
    return url ? (
      <a class="bk-button bk-button--primary" href={url} rel="noopener noreferrer" target="_blank">
        <BkText text={el().text} />
      </a>
    ) : (
      <button
        class="bk-button bk-button--primary"
        disabled={pending()}
        onClick={() => dispatch({})}
        type="button"
      >
        <BkText text={el().text} />
      </button>
    );
  }

  if (el().type === "feedback_buttons") {
    return (
      <div class="bk-feedback-buttons">
        <button
          aria-label={el().positive_button?.text.text ?? "Helpful"}
          class="bk-feedback-button"
          disabled={pending()}
          onClick={() => dispatch({ value: el().positive_button?.value })}
          type="button"
        >
          <BkText text={el().positive_button?.text} />
        </button>
        <button
          aria-label={el().negative_button?.text.text ?? "Not helpful"}
          class="bk-feedback-button"
          disabled={pending()}
          onClick={() => dispatch({ value: el().negative_button?.value })}
          type="button"
        >
          <BkText text={el().negative_button?.text} />
        </button>
      </div>
    );
  }

  if (el().type === "icon_button") {
    return (
      <button
        aria-label={el().accessibility_label ?? el().text?.text ?? "Action"}
        class="bk-icon-button"
        disabled={pending()}
        onClick={() => dispatch({ value: el().value })}
        title={el().text?.text}
        type="button"
      >
        {el().icon ?? "•"}
      </button>
    );
  }

  if (el().type === "file_input") {
    return (
      <input
        class="bk-control"
        disabled
        title="File inputs are available in Slack modals"
        type="file"
      />
    );
  }

  if (el().type === "rich_text_input") {
    return (
      <textarea
        class="bk-control bk-control--textarea"
        disabled
        placeholder={placeholder()}
        title="Rich text inputs are available in Slack modals"
      />
    );
  }

  if (el().type === "checkboxes" || el().type === "radio_buttons") {
    return (
      <form class="bk-options" onChange={(event) => choose(event.currentTarget)}>
        <For each={selectOptions()}>
          {(option, index) => {
            const key = option.value ?? option.text.text;
            const checked = () =>
              el().type === "checkboxes" ? initialValues().includes(key) : initialValue() === key;
            return (
              <label class="bk-option">
                <input
                  checked={checked()}
                  name={`bk-${props.blockId}-${el().action_id}-${index()}`}
                  type={el().type === "checkboxes" ? "checkbox" : "radio"}
                  value={String(index())}
                />
                <BkText text={option.text} />
              </label>
            );
          }}
        </For>
      </form>
    );
  }

  if (el().type.endsWith("select")) {
    const options = selectOptions();
    return (
      <select
        class="bk-control"
        disabled={pending() || !options.length}
        multiple={isMulti()}
        onChange={(event) => select(event.currentTarget)}
        title={options.length ? undefined : "This menu loads its options from its app in Slack"}
        value={isMulti() ? initialValues() : initialValue()}
      >
        <Show when={!isMulti()}>
          <option value="">{placeholder()}</option>
        </Show>
        <For each={options}>
          {(option, index) => <option value={String(index())}>{option.text.text}</option>}
        </For>
      </select>
    );
  }

  if (el().type === "datepicker" || el().type === "timepicker" || el().type === "datetimepicker") {
    const picker = el();
    const type =
      picker.type === "datepicker"
        ? "date"
        : picker.type === "timepicker"
          ? "time"
          : "datetime-local";
    const initial =
      picker.type === "datepicker"
        ? picker.initial_date
        : picker.type === "timepicker"
          ? picker.initial_time
          : picker.initial_datetime
            ? new Date(picker.initial_datetime * 1000).toISOString().slice(0, 16)
            : undefined;
    return (
      <input
        class="bk-control"
        disabled={pending()}
        onChange={(event) =>
          dispatch(
            el().type === "datepicker"
              ? { selected_date: event.currentTarget.value }
              : el().type === "timepicker"
                ? { selected_time: event.currentTarget.value }
                : {
                    selected_date_time: Math.floor(
                      new Date(event.currentTarget.value).getTime() / 1000,
                    ),
                  },
          )
        }
        type={type}
        value={initial}
      />
    );
  }

  const inputType =
    el().type === "email_text_input"
      ? "email"
      : el().type === "url_text_input"
        ? "url"
        : el().type === "number_input"
          ? "number"
          : "text";
  return el().multiline ? (
    <textarea
      class="bk-control bk-control--textarea"
      disabled={pending()}
      onChange={(event) => dispatch({ value: event.currentTarget.value })}
      placeholder={placeholder()}
      value={el().initial_value}
    />
  ) : (
    <input
      class="bk-control"
      disabled={pending()}
      onChange={(event) => dispatch({ value: event.currentTarget.value })}
      placeholder={placeholder()}
      type={inputType}
      value={el().initial_value}
    />
  );
}
