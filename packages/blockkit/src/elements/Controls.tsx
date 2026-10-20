import { Slot } from "@slock/core/solid";
import type { BlockElement, ConfirmationDialog, TextObject } from "@slock/types";
import { ICON_NAMES, Icon, type IconName, isOneOf, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import { useBlockActionDispatch } from "../useBlockActionDispatch";
import ChoiceGroup from "./ChoiceGroup";
import "./Controls.css";
import {
  isChoiceGroup,
  isFileInput,
  isPicker,
  isRichTextInput,
  isSelect,
  isTextInput,
} from "./guards";
import Picker from "./Picker";
import Select from "./Select";
import TextInput from "./TextInput";

type ButtonData = {
  accessibility_label?: string;
  action_id?: string;
  confirm?: ConfirmationDialog;
  icon?: string;
  negative_button?: { text: TextObject; value?: string };
  positive_button?: { text: TextObject; value?: string };
  text?: TextObject;
  type: string;
  url?: string;
  value?: string;
  workflow?: { trigger?: { url?: string } };
};

export default function Controls(props: {
  blockId?: string;
  context?: BlockActionContext;
  el: BlockElement;
  stateOnly?: boolean;
}) {
  const element = props.el;
  const data: ButtonData = element;
  const {
    canDispatch,
    dispatch: dispatchAction,
    pending,
    record: recordAction,
  } = useBlockActionDispatch(() => props.context);
  const ready = () =>
    props.stateOnly ? !!data.action_id : !pending() && canDispatch(data.action_id);

  const action = (payload: Record<string, unknown>) => ({
    action_id: data.action_id,
    block_id: props.blockId,
    type: data.type,
    ...payload,
  });
  const record = (payload: Record<string, unknown>) => recordAction(action(payload));
  const dispatch = (payload: Record<string, unknown>) => {
    record(payload);
    if (!props.stateOnly) return dispatchAction(action(payload), data.confirm);
  };
  const dispatchOn = () => {
    if (props.stateOnly) return [];
    const config = isTextInput(element) ? element.dispatch_action_config : undefined;
    return config?.trigger_actions_on ?? ["on_enter_pressed"];
  };
  const iconName = (): IconName | undefined =>
    data.icon && isOneOf(data.icon, ICON_NAMES) ? data.icon : undefined;

  if (data.type === "workflow_button") {
    const url = data.workflow?.trigger?.url ?? data.url;
    return url ? (
      <a class="bk-button bk-button--primary" href={url} rel="noopener noreferrer" target="_blank">
        <BkText text={data.text} />
      </a>
    ) : (
      <button
        class="bk-button bk-button--primary"
        disabled={!ready()}
        onClick={() => dispatch({})}
        type="button"
      >
        <BkText text={data.text} />
      </button>
    );
  }

  if (data.type === "feedback_buttons") {
    return (
      <div class="bk-feedback-buttons">
        <Tooltip content={data.positive_button?.text.text ?? "Good response"}>
          <button
            aria-label={data.positive_button?.text.text ?? "Good response"}
            class="bk-feedback-button bk-feedback-button--positive hover-hl"
            disabled={!ready()}
            onClick={() => dispatch({ value: data.positive_button?.value })}
            type="button"
          >
            <Icon name="thumbs-up" size={15} />
          </button>
        </Tooltip>
        <Tooltip content={data.negative_button?.text.text ?? "Bad response"}>
          <button
            aria-label={data.negative_button?.text.text ?? "Bad response"}
            class="bk-feedback-button bk-feedback-button--negative hover-hl"
            disabled={!ready()}
            onClick={() => dispatch({ value: data.negative_button?.value })}
            type="button"
          >
            <Icon name="thumbs-down" size={15} />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (data.type === "icon_button") {
    return (
      <button
        aria-label={data.accessibility_label ?? data.text?.text ?? "Action"}
        class="bk-icon-button hover-hl"
        disabled={!ready()}
        onClick={() => dispatch({ value: data.value })}
        title={data.text?.text}
        type="button"
      >
        <Show fallback={data.icon ?? "•"} when={iconName()}>
          {(name) => <Icon name={name()} size={16} />}
        </Show>
      </button>
    );
  }

  if (isFileInput(element)) {
    return (
      <Slot
        disabled={!ready()}
        filetypes={element.filetypes}
        maxFiles={element.max_files}
        onChange={(files) => dispatch({ files })}
        point="blockkit.fileInput"
      />
    );
  }

  if (isRichTextInput(element)) {
    return (
      <Slot
        disabled={!ready()}
        initial={element.initial_value}
        onChange={(value) => dispatch({ rich_text_value: value })}
        placeholder={element.placeholder?.text}
        point="blockkit.richTextInput"
      />
    );
  }

  if (isChoiceGroup(element)) {
    return (
      <ChoiceGroup
        dispatch={dispatch}
        el={element}
        name={`bk-${props.blockId}-${data.action_id}`}
        ready={ready()}
      />
    );
  }

  if (isSelect(element)) {
    return (
      <Select
        blockId={props.blockId}
        context={props.context}
        dispatch={dispatch}
        el={element}
        ready={ready()}
      />
    );
  }

  if (isPicker(element)) return <Picker dispatch={dispatch} el={element} ready={ready()} />;

  if (isTextInput(element)) {
    return (
      <TextInput
        dispatch={dispatch}
        dispatchOn={dispatchOn()}
        el={element}
        ready={ready()}
        record={record}
      />
    );
  }

  return null;
}
