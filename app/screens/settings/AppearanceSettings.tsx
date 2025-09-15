// screens/settings/AppearanceSettings.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function AppearanceSettings() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<{ dark_mode?: boolean }>({ dark_mode: false });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: userResp } = await supabase.auth.getUser();
        const uid = userResp?.user?.id;
        if (!uid) {
          if (mounted) setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", uid)
          .maybeSingle();

        if (error) {
          console.warn("appearance load error:", error);
        } else {
          const stored = data?.preferences ?? {};
          if (mounted) setPrefs(stored);
        }
      } catch (e) {
        console.warn("appearance load unexpected error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const toggle = async (key: "dark_mode") => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Update the preferences JSON column in profiles
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: next })
        .eq("id", uid);

      if (error) throw error;

      // Notify app to re-read preference & update theme
      DeviceEventEmitter.emit("appearanceChanged", next);
    } catch (e: any) {
      console.error("appearance save err", e);
      Alert.alert("Error", "Could not save appearance setting");
      // rollback local state (re-read from DB would be ideal)
      setPrefs((p) => ({ ...p, [key]: !next[key] }));
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Dark mode</Text>
        <Switch
          value={!!prefs.dark_mode}
          onValueChange={() => toggle("dark_mode")}
        />
      </View>
      <Text style={{ marginTop: 12, color: "#6b7280" }}>
        Toggle dark mode preference. Your preference will be saved to your profile and applied immediately.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontWeight: "600" },
});