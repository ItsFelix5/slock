import { narrowByType } from "@slock/core";
import type { Block, InputBlock, TextInputElement } from "@slock/types";
import { isTextInput } from "./elements/guards";
import { statefulElements, type ViewValues } from "./viewState";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasContent(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasContent);
  if (!node || typeof node !== "object") return false;
  if ("text" in node && typeof node.text === "string") return node.text.trim().length > 0;
  if ("elements" in node) return hasContent(node.elements);
  return true;
}

function isFilled(payload: Record<string, unknown>): boolean {
  return Object.entries(payload).some(([key, value]) => {
    if (key === "type" || value === null || value === undefined) return false;
    if (key === "rich_text_value") return hasContent(value);
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

function textProblem(element: TextInputElement, value: string): string | undefined {
  if (element.min_length && value.length < element.min_length) {
    return `Use at least ${element.min_length} characters`;
  }
  if (element.max_length && value.length > element.max_length) {
    return `Use at most ${element.max_length} characters`;
  }
  if (element.type === "email_text_input" && !EMAIL.test(value)) return "Enter an email address";
  if (element.type === "url_text_input" && !URL.canParse(value)) return "Enter a URL";
  if (element.type !== "number_input") return;
  const number = Number(value);
  if (Number.isNaN(number)) return "Enter a number";
  if (!(element.is_decimal_allowed || Number.isInteger(number))) return "Enter a whole number";
  if (element.min_value !== undefined && number < Number(element.min_value)) {
    return `Use ${element.min_value} or more`;
  }
  if (element.max_value !== undefined && number > Number(element.max_value)) {
    return `Use ${element.max_value} or less`;
  }
}

export function validateView(blocks: Block[], { values }: ViewValues) {
  const errors: Record<string, string> = {};
  for (const block of blocks) {
    const input = narrowByType<Block, InputBlock>(block, "input");
    const { block_id: blockId } = block;
    if (!(input && blockId)) continue;
    const actionId = statefulElements([block])[0]?.element.action_id;
    const payload = actionId ? values[blockId]?.[actionId] : undefined;
    if (!(payload && isFilled(payload))) {
      if (!input.optional) errors[blockId] = "Required";
      continue;
    }
    const { element } = input;
    const problem =
      isTextInput(element) && typeof payload.value === "string"
        ? textProblem(element, payload.value)
        : undefined;
    if (problem) errors[blockId] = problem;
  }
  return errors;
}
