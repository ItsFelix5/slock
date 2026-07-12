import { createKeyedFeedback } from "@slock/ui";

// Shared by every store slice as a toast-stack replacement: a mutation flashes
// a message keyed to the entity it acted on (a channel id, message ts, etc.),
// and whatever row/panel renders that entity shows it inline via
// `actionFeedback.get(key)` + <InlineFeedback>.
export const actionFeedback = createKeyedFeedback();
