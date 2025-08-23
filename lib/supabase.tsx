import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = "https://exowkuckfiikkizclved.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3drdWNrZmlpa2tpemNsdmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNTk5MTcsImV4cCI6MjA2OTYzNTkxN30.4dbcMiZ1u8o7KGOm-I0aZzJkwgrgv8zFpFwa2mFQZLY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
// Optional sync function
export const syncUserProfile = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: user.user_metadata?.username || "guest",
    avatar_url: user.user_metadata?.avatar_url || null,
  });

  if (error) console.error("Error syncing profile:", error.message);
};

// Optional session logging
supabase.auth.getSession().then(({ data }) => {
  console.log("Session:", data?.session);
});
