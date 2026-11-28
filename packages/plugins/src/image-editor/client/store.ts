import { createSignal } from "solid-js";

type Session = { file: File; finish: (edited: File | undefined) => void };

export function createImageEditorStore() {
  const [session, setSession] = createSignal<Session>();
  return {
    edit(file: File): Promise<File | undefined> {
      return new Promise((resolve) => {
        session()?.finish(undefined);
        setSession({
          file,
          finish: (edited) => {
            setSession(undefined);
            resolve(edited);
          },
        });
      });
    },
    session,
  };
}
