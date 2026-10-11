import type { Component } from "solid-js";

export type ConnectMethodProps = {
  connected(): void;
  setError(message: string | null): void;
};

export type AccountService = {
  restart(): Promise<void>;
  logout(): Promise<boolean>;
};

declare module "@slock/core/types" {
  interface Points {
    "account.connect": Component<ConnectMethodProps>;
    "account.section": Component;
  }
  interface Services {
    account: AccountService;
  }
}
