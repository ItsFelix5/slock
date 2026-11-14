import type { BindEditor } from "../../composer/client/api";

const SEND_INTERVAL_MS = 3000;

export function sendTyping(send: (payload: unknown) => boolean): BindEditor {
  return (quill, editor) => {
    const { props } = editor;
    if (!props || props.editing) return;
    let lastSent = 0;
    const onChange = (_delta: unknown, _old: unknown, source: string) => {
      const now = Date.now();
      if (source !== "user" || now - lastSent < SEND_INTERVAL_MS || !quill.getText().trim()) return;
      lastSent = now;
      send({ channel: props.channelId, thread_ts: props.threadTs, type: "typing" });
    };
    quill.on("text-change", onChange);
    return () => quill.off("text-change", onChange);
  };
}
