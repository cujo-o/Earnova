import { supabase } from "./supabase";

export async function getProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("No user logged in");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(profileData) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("No user logged in");

  const updates = {
    id: user.id,
    ...profileData,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(updates);
  if (error) throw error;

  return updates;
}
