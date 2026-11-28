export type Identity = { team: string; user: string };

export type Authenticate = (req: Request) => Identity | undefined | Promise<Identity | undefined>;

/** Rejects everyone until a real authenticator is wired in. */
export const authenticate: Authenticate = () => undefined;
