import "react-native-url-polyfill/auto"; // must come first!
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = "https://exowkuckfiikkizclved.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3drdWNrZmlpa2tpemNsdmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNTk5MTcsImV4cCI6MjA2OTYzNTkxN30.4dbcMiZ1u8o7KGOm-I0aZzJkwgrgv8zFpFwa2mFQZLY";

const isWeb = Platform.OS === "web";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
