import { supabase } from "./supabase";

export async function signUp(email, password) {
  const { user, error } = await supabase.auth.signUp({ email, password });
  return { user, error };
}

export async function signIn(email, password) {
  const { user, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { user, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}
