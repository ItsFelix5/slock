import type { UserId } from "@slock/types";
import { defineQuery } from "../../query/client/api";
import { fetchUserDnd } from "./fetch";

export const userDnd = defineQuery<UserId, number | null>({ load: fetchUserDnd, name: "userDnd" });
