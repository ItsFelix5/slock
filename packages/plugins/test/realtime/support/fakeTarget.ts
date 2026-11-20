export type FakeEvent = { data?: unknown };
type Listener = (event: FakeEvent) => void;

export class FakeTarget {
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
  }

  emit(type: string, event: FakeEvent = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}
