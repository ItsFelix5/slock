import {
  setPresence as apiSetPresence,
  setProfileFields as apiSetProfileFields,
  setStatus as apiSetStatus,
  uploadProfilePhoto as apiUploadProfilePhoto,
  fetchAppDescription,
  fetchUser,
  fetchUserPresence,
  fetchUserProfile,
  searchDirectory,
} from "../../../slack/client/api";

export type UsersApi = {
  fetchAppDescription: typeof fetchAppDescription;
  fetchUser: typeof fetchUser;
  fetchUserProfile: typeof fetchUserProfile;
  fetchUserPresence: typeof fetchUserPresence;
  searchDirectory: typeof searchDirectory;
  setPresence: typeof apiSetPresence;
  setProfileFields: typeof apiSetProfileFields;
  setStatus: typeof apiSetStatus;
  uploadProfilePhoto: typeof apiUploadProfilePhoto;
};

export const DEFAULT_USERS_API: UsersApi = {
  fetchAppDescription,
  fetchUser,
  fetchUserProfile,
  fetchUserPresence,
  searchDirectory,
  setPresence: apiSetPresence,
  setProfileFields: apiSetProfileFields,
  setStatus: apiSetStatus,
  uploadProfilePhoto: apiUploadProfilePhoto,
};
