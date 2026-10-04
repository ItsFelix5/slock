import type Quill from "quill";
import { createSignal, onMount } from "solid-js";
import type { CanvasNames } from "../../../lib/canvas/canvasEmbeds";

export interface CanvasServices {
  activate(quill: Quill): void;
  afterChange(quill: Quill): void;
  names: CanvasNames;
  newId(): string;
  readOnly: boolean;
  register(scope: () => string, quill: Quill): () => void;
}

const ROOT_CLASS = ".canvas-editor";
const registry = new WeakMap<Element, CanvasServices>();

export function provideCanvasServices(root: Element, services: CanvasServices): () => void {
  registry.set(root, services);
  return () => registry.delete(root);
}

export function canvasServicesFor(node: Element): CanvasServices | undefined {
  const root = node.closest(ROOT_CLASS);
  return root ? registry.get(root) : undefined;
}

export function useCanvasServices(node: Element) {
  const [services, setServices] = createSignal<CanvasServices>();
  onMount(() => queueMicrotask(() => setServices(canvasServicesFor(node))));
  return services;
}
