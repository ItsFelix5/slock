declare const brand: unique symbol;

type Brand<Name extends string> = string & { readonly [brand]: Name };

export type ChannelId = Brand<"ChannelId">;
export type FileId = Brand<"FileId">;
export type TeamId = Brand<"TeamId">;
export type Ts = Brand<"Ts">;
export type UserId = Brand<"UserId">;
