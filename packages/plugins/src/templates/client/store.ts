import type { Block, SlackFile } from "@slock/types";
import { createLocalPref } from "../../slack/client/api/localPref";

export type ComposerTemplate = {
  id: string;
  name: string;
  blocks: Block[];
  files?: SlackFile[];
};

export function createTemplatesStore() {
  const [templates, persist] = createLocalPref<ComposerTemplate[]>("composer-templates", []);

  function saveTemplate(name: string, blocks: Block[], files?: SlackFile[]): ComposerTemplate {
    const template: ComposerTemplate = {
      blocks,
      files: files?.length ? files : undefined,
      id: crypto.randomUUID(),
      name: name.trim(),
    };
    persist([...templates(), template]);
    return template;
  }

  function renameTemplate(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist(templates().map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
  }

  function removeTemplate(id: string) {
    persist(templates().filter((t) => t.id !== id));
  }

  return { removeTemplate, renameTemplate, saveTemplate, templates };
}
