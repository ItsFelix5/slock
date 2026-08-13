import { createSignal } from "solid-js";

const LOG_DELETED_KEY = "slock-log-deleted-messages";
const [logDeletedMessages, setLogDeletedMessagesSignal] = createSignal(
  localStorage.getItem(LOG_DELETED_KEY) === "1",
);

export function setLogDeletedMessages(on: boolean) {
  setLogDeletedMessagesSignal(on);
  localStorage.setItem(LOG_DELETED_KEY, on ? "1" : "0");
}

export { logDeletedMessages };
