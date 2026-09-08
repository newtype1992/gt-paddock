import { createClient } from "@supabase/supabase-js";
import { emptyData, kinds, sampleData } from "./data";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
const storageKey = "gt-paddock-demo-v2";
export async function loadWorkspace(user) {
  if (!user) {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!kinds.every((kind) => Array.isArray(parsed[kind])))
        throw new Error(
          "The local workspace is invalid. Clear this site's storage to recover.",
        );
      return parsed;
    }
    const data = sampleData();
    localStorage.setItem(storageKey, JSON.stringify(data));
    return data;
  }
  const { data, error } = await supabase
    .from("paddock_records")
    .select("id, kind, payload")
    .eq("owner_id", user.id)
    .order("created_at");
  if (error) throw error;
  const result = emptyData();
  data.forEach((row) => {
    if (result[row.kind]) result[row.kind].push({ ...row.payload, id: row.id });
  });
  return result;
}
export async function persistRecord(
  user,
  workspace,
  kind,
  record,
  remove = false,
) {
  const next = {
    ...workspace,
    [kind]: remove
      ? workspace[kind].filter((r) => r.id !== record.id)
      : workspace[kind].some((r) => r.id === record.id)
        ? workspace[kind].map((r) => (r.id === record.id ? record : r))
        : [...workspace[kind], record],
  };
  if (!user) localStorage.setItem(storageKey, JSON.stringify(next));
  else {
    const query = supabase.from("paddock_records");
    const result = remove
      ? await query
          .delete()
          .eq("id", record.id)
          .eq("owner_id", user.id)
          .select("id")
      : await query
          .upsert({ id: record.id, owner_id: user.id, kind, payload: record })
          .select("id");
    if (result.error) throw result.error;
    if (result.data.length !== 1)
      throw new Error("The record could not be saved. Refresh and try again.");
  }
  return next;
}
