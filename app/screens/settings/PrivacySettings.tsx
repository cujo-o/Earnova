// screens/settings/PrivacySettings.tsx
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

export default function PrivacySettings() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<any>({ public_profile: true });

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
    } catch (e: any) {
      console.error("privacy save err", e);
      Alert.alert("Error", "Could not save privacy settings");
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Public profile (show on swipe/explore)</Text>
        <Switch
          value={!!prefs.public_profile}
          onValueChange={() => toggle("public_profile")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  label: { flex: 1, marginRight: 12, fontWeight: "600" },
});
