import { expect, test } from "bun:test";
import { createUsergroupsSlice } from "../../../../packages/plugins/src/usergroups/client/store";
import { createFakeEnv } from "../../../support/core";
import { jsonReply, settle, startQueryHost, watch } from "../../../support/queryHost";

test("a missing usergroup is asked about again only after the answer expires", async () => {
  const env = createFakeEnv();
  await startQueryHost(env);
  env.fetch.respond("/api/usergroups/lookup", () => jsonReply({ usergroups: {} }));
  const store = createUsergroupsSlice({ allUsergroupIds: () => [], selfUsergroupIds: () => [] });
  const read = () => store.usergroupById("S1");
  const first = watch(read);
  await settle();
  first();
  watch(read)();
  await settle();
  expect(env.fetch.calls).toHaveLength(1);
  env.advance(30_000);
  const later = watch(read);
  await settle();
  expect(env.fetch.calls).toHaveLength(2);
  later();
});
