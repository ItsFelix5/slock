import type { UsergroupDetails } from "../../lib/api";

export type UsergroupDetailsDraft = Pick<UsergroupDetails, "title" | "handle" | "description">;
export type EditableUsergroupDetails = UsergroupDetailsDraft & Pick<UsergroupDetails, "id">;

function usergroupDetailsDraft(details: UsergroupDetails): UsergroupDetailsDraft {
  return { description: details.description, handle: details.handle, title: details.title };
}

export function editableUsergroupDetails(details: UsergroupDetails): EditableUsergroupDetails {
  return { id: details.id, ...usergroupDetailsDraft(details) };
}

export function mergeUsergroupDetailsDraft(
  current: UsergroupDetailsDraft,
  previousServer: EditableUsergroupDetails | undefined,
  nextServer: UsergroupDetails,
): UsergroupDetailsDraft {
  if (!previousServer || previousServer.id !== nextServer.id)
    return usergroupDetailsDraft(nextServer);
  return {
    description:
      current.description === previousServer.description
        ? nextServer.description
        : current.description,
    handle: current.handle === previousServer.handle ? nextServer.handle : current.handle,
    title: current.title === previousServer.title ? nextServer.title : current.title,
  };
}
