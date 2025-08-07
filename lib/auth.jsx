import { supabase } from "./supabase";

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { user: data?.user, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data?.user, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}
