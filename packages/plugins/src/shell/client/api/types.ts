export interface PaneContents extends Record<never, never> {}

export type PaneContentOf<K extends keyof PaneContents> = { kind: K } & PaneContents[K];

export type PaneContent = { [K in keyof PaneContents]: PaneContentOf<K> }[keyof PaneContents];
