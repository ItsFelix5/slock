import { createKeyedFeedback } from "@slock/ui";

export const actionFeedback = createKeyedFeedback();

export function composerFeedbackKey(key: string): string {
  return `composer:${key}`;
}
