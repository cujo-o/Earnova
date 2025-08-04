import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://exowkuckfiikkizclved.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3drdWNrZmlpa2tpemNsdmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNTk5MTcsImV4cCI6MjA2OTYzNTkxN30.4dbcMiZ1u8o7KGOm-I0aZzJkwgrgv8zFpFwa2mFQZLY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
