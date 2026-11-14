import type { Setup } from "@slock/core";
import UserMemberships from "./UserMemberships";

const setup: Setup = (ctx) => {
  ctx.add("profile.meta", UserMemberships, { order: 60 });
};

export default setup;
