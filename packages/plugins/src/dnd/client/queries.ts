import { defineQuery } from "@slock/plugins/query/client/api";
import type { UserId } from "@slock/types";
import { fetchUserDnd } from "./fetch";

export const userDnd = defineQuery<UserId, number | null>({ load: fetchUserDnd, name: "userDnd" });
