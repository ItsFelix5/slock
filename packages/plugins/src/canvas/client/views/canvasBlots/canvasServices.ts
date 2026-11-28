import type { CanvasAccess } from "@slock/types";
import type Quill from "@slock/ui/editor/quill";
import { createSignal, onSettled } from "solid-js";
import type { CanvasNames } from "../../lib/canvasEmbeds";

export interface CanvasServices {
  access: CanvasAccess;
  activate(quill: Quill): void;
  afterChange(quill: Quill): void;
  movesAnnotation(id: string): boolean;
  names: CanvasNames;
  newId(): string;
  register(scope: () => string, quill: Quill): () => void;
  upload(quill: Quill, files: File[]): void;
}

const ROOT_CLASS = ".canvas-editor";
const registry = new WeakMap<Element, CanvasServices>();

export function provideCanvasServices(root: Element, services: CanvasServices) {
  registry.set(root, services);
}

export function canvasServicesFor(node: Element): CanvasServices | undefined {
  const root = node.closest(ROOT_CLASS);
  return root ? registry.get(root) : undefined;
}

export function useCanvasServices(node: Element) {
  const [services, setServices] = createSignal<CanvasServices>();
  onSettled(() => queueMicrotask(() => setServices(canvasServicesFor(node))));
  return services;
}
