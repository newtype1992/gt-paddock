import { profileIdentifier } from "./gt7-model.js";

export function validateDriverProfile(draft) {
  const display_name = draft.display_name.trim();
  if (!display_name || display_name.length > 60)
    throw new Error("Display name must be 1 to 60 characters.");
  const psn_id = draft.psn_id.trim() || null;
  if (psn_id && !/^[A-Za-z0-9_-]{3,16}$/.test(psn_id))
    throw new Error(
      "PSN ID must be 3 to 16 letters, numbers, underscores or hyphens.",
    );
  let gt7_profile_url = draft.gt7_profile_url.trim() || null;
  if (gt7_profile_url) {
    profileIdentifier(gt7_profile_url);
    const url = new URL(gt7_profile_url);
    gt7_profile_url =
      "https://www.gran-turismo.com" +
      url.pathname.toLowerCase().replace(/\/$/, "") +
      "/";
  }
  return { display_name, psn_id, gt7_profile_url, visibility: "private" };
}
