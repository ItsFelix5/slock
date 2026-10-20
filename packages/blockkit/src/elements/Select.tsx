import { usePoint } from "@slock/core/solid";
import type { Option, SelectElement } from "@slock/types";
import { Combobox, type ComboboxOption, fuzzySearch } from "@slock/ui";
import { createSignal, onMount } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import { fetchExternalOptions } from "../blockActions";
import type { EntityKind } from "../entitySource";
import { flattenOptions, optionKey, optionPayload, toComboboxOption } from "./options";

type SelectKind = EntityKind | "external" | "static";

const ENTITY_KEY = { channels: "channel", conversations: "conversation", users: "user" } as const;
const DEFAULT_MIN_QUERY = 3;

function kindOf(type: string): SelectKind {
  const base = type.replace("multi_", "");
  if (base === "static_select") return "static";
  if (base === "external_select") return "external";
  if (base === "users_select") return "users";
  if (base === "conversations_select") return "conversations";
  return "channels";
}

function initialIds(el: SelectElement, kind: EntityKind, multi: boolean): string[] {
  const pick = (one?: string, many?: string[]) => (multi ? (many ?? []) : one ? [one] : []);
  if (kind === "users") return pick(el.initial_user, el.initial_users);
  if (kind === "channels") return pick(el.initial_channel, el.initial_channels);
  return pick(el.initial_conversation, el.initial_conversations);
}

export default function Select(props: {
  blockId?: string;
  context?: BlockActionContext;
  dispatch: (payload: Record<string, unknown>) => void;
  el: SelectElement;
  ready: boolean;
}) {
  const kind = kindOf(props.el.type);
  const multi = props.el.type.startsWith("multi_");
  const source = usePoint("blockkit.entitySource");
  const known = new Map<string, Option>();

  const remember = (options: { group?: string; option: Option }[]) =>
    options.map(({ group, option }) => {
      known.set(optionKey(option), option);
      return toComboboxOption(option, group);
    });

  const entityKind = kind === "static" || kind === "external" ? undefined : kind;
  const currentDefault = () =>
    entityKind === "conversations" &&
    props.el.default_to_current_conversation &&
    !initialIds(props.el, entityKind, multi).length
      ? source()[0]?.currentConversation()
      : undefined;

  const initial = (): ComboboxOption[] => {
    if (entityKind) {
      const ids = initialIds(props.el, entityKind, multi);
      const fallback = currentDefault();
      return (fallback ? [fallback] : ids).map((id) => ({ id, label: id }));
    }
    const options = multi
      ? (props.el.initial_options ?? [])
      : props.el.initial_option
        ? [props.el.initial_option]
        : [];
    return remember(options.map((option) => ({ option })));
  };

  const [selected, setSelected] = createSignal(initial());

  const labelled = () =>
    entityKind
      ? selected().map((item) => source()[0]?.describe(entityKind, item.id) ?? item)
      : selected();

  const payload = (items: ComboboxOption[]) => {
    if (entityKind) {
      const key = ENTITY_KEY[entityKind];
      const ids = items.map((item) => item.id);
      return multi ? { [`selected_${key}s`]: ids } : { [`selected_${key}`]: ids[0] ?? null };
    }
    const options = items.flatMap((item) => known.get(item.id) ?? []);
    return multi
      ? { selected_options: options.map(optionPayload) }
      : { selected_option: options[0] ? optionPayload(options[0]) : null };
  };

  const resolveConversations = (items: ComboboxOption[]) =>
    Promise.all(
      items.map(async (item) => ({
        ...item,
        id: (await source()[0]?.conversationId(item.id)) ?? item.id,
      })),
    );

  const change = (items: ComboboxOption[]) => {
    const previous = selected();
    setSelected(items);
    if (entityKind !== "conversations") return props.dispatch(payload(items));
    resolveConversations(items).then(
      (resolved) => {
        setSelected(resolved);
        props.dispatch(payload(resolved));
      },
      () => setSelected(previous),
    );
  };

  onMount(() => {
    if (currentDefault()) props.dispatch(payload(selected()));
  });

  const search = async (query: string): Promise<ComboboxOption[]> => {
    if (entityKind) return (await source()[0]?.search(entityKind, query, props.el.filter)) ?? [];
    if (kind === "static") {
      const all = flattenOptions(props.el.options, props.el.option_groups);
      return remember(fuzzySearch(all, { query, text: (entry) => entry.option.text.text }));
    }
    if (!props.context || query.length < (props.el.min_query_length ?? DEFAULT_MIN_QUERY))
      return [];
    const found = await fetchExternalOptions(props.context, {
      actionId: props.el.action_id ?? "",
      blockId: props.blockId,
      value: query,
    });
    return remember(flattenOptions(found.options, found.groups));
  };

  return (
    <Combobox
      disabled={!(props.ready && (kind !== "external" || props.context?.botId))}
      emptyText={kind === "external" ? "Type to search" : undefined}
      max={props.el.max_selected_items}
      multiple={multi}
      onChange={change}
      placeholder={props.el.placeholder?.text ?? "Select an option"}
      search={search}
      value={labelled()}
    />
  );
}
