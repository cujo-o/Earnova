// screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", user.id)
        .single();

      setProfile({ ...data, email: user.email });
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.replace("Auth");
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      const file = result.assets[0];
      const filePath = `${profile.id}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, {
          uri: file.uri,
          type: "image/jpeg",
          name: "avatar.jpg",
        } as any);

      if (!error) {
        const { data: publicUrl } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl.publicUrl })
          .eq("id", profile.id);

        setProfile({ ...profile, avatar_url: publicUrl.publicUrl });
      }
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickAvatar}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text>Pick Avatar</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.name}>{profile?.full_name}</Text>
      <Text style={styles.name}>@{profile?.username}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  avatarPlaceholder: {
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  email: { color: "#6b7280", marginBottom: 20 },
  logoutBtn: {
    padding: 12,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    marginTop: 20,
  },
  logoutText: { color: "#fff", fontWeight: "600" },
});
