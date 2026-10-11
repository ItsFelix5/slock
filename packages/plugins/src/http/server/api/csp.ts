export type CspDirectives = Record<string, string[]>;

declare module "@slock/core/types" {
  interface Points {
    "http.csp": CspDirectives | (() => CspDirectives);
  }
}
