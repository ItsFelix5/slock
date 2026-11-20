import { defineQuery } from "../../query/client/api";
import { fetchUserDnd } from "./fetch";

export const userDnd = defineQuery<string, number | null>({ load: fetchUserDnd, name: "userDnd" });
