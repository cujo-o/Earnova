// screens/settings/AppearanceSettings.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function AppearanceSettings() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<any>({ dark_mode: false });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", uid)
        .maybeSingle();
      if (data?.preferences) setPrefs({ ...prefs, ...data.preferences });
      setLoading(false);
    })();
  }, []);

  const toggle = async (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: next })
        .eq("id", uid);
      if (error) throw error;
      // NOTE: you need to have your app read this preference and apply theme changes
    } catch (e: any) {
      console.error("appearance save err", e);
      Alert.alert("Error", "Could not save appearance setting");
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
        Toggle dark mode preference. (Make sure your app reads this preference
        at startup.)
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
