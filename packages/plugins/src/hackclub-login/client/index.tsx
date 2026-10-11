import type { Setup } from "@slock/core";
import HackclubForm from "./views/HackclubForm";

const setup: Setup = (ctx) => {
  ctx.add("account.connect", HackclubForm, { order: 0 });
};

export default setup;
