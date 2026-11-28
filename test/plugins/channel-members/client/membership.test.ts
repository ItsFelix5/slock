import { expect, test } from "bun:test";
import { ANA, json, person, refusal, startMembers } from "./membersHarness";

test("adding shows the person once Slack accepts, and refuses a second click meanwhile", async () => {
  const h = await startMembers();
  h.env.fetch.hold(/\/members$/);
  const first = h.members.addPerson(person);
  expect(h.members.isAdding(ANA)).toBe(true);
  await h.members.addPerson(person);
  expect(h.env.fetch.pending()).toHaveLength(1);
  expect(h.members.filteredMembers()).toEqual([]);
  h.env.fetch.pending()[0]?.resolve(json({}));
  await first;
  await h.settle();
  expect(h.members.filteredMembers()).toEqual([person]);
  expect(h.members.isAdding(ANA)).toBe(false);
  expect(h.rosters).toHaveLength(1);
  expect(h.changes()).toBe(1);
});

test("adding an app reloads the apps list", async () => {
  const h = await startMembers();
  h.members.setFilter("apps");
  await h.settle();
  h.env.fetch.respond(/\/members$/, json({}));
  await h.members.addPerson({ ...person, isBot: true });
  await h.settle();
  expect(h.loads).toEqual(["everyone", "apps", "apps"]);
});

test("promoting and removing update the manager list without a reload", async () => {
  const h = await startMembers();
  h.env.fetch.respond(/\/managers$/, json({}));
  await h.members.makeManager(person);
  await h.settle();
  expect(h.members.isManager(ANA)).toBe(true);
  expect(h.members.filterCount("managers")).toBe(1);
  h.env.fetch.respond(/\/members\/UANA$/, json({}));
  await h.members.removeMember(person);
  await h.settle();
  expect(h.members.isManager(ANA)).toBe(false);
  expect(h.changes()).toBe(1);
});

test("a refused removal reports the failure and changes nothing", async () => {
  const h = await startMembers();
  h.env.fetch.respond(/\/members\/UANA$/, refusal("cant_kick_self"));
  await h.members.removeMember(person);
  expect(h.failures).toEqual(["Failed to remove from channel."]);
  expect(h.changes()).toBe(0);
});
