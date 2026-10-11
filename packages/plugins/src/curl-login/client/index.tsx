import type { Setup } from "@slock/core";
import CurlForm from "./views/CurlForm";

const setup: Setup = (ctx) => {
  ctx.add("account.connect", CurlForm, { order: 10 });
};

export default setup;
