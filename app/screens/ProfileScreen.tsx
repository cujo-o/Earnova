// screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useNavigation } from "@react-navigation/native";
import { Platform } from "react-native";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // ensures a profile row exists; fetches profile and sets state
  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // try fetch profile row
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 sometimes returned when no rows, ignore that case
        console.warn("profiles select error:", error.message);
      }

      if (!data) {
        // no profile row — create one (safe upsert)
        const defaultUsername = user.email ? user.email.split("@")[0] : user.id;
        const { error: upsertErr } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            username: defaultUsername,
            full_name: null,
            bio: null,
            avatar_url: null,
          },
          { onConflict: "id" }
        );
        if (upsertErr) console.warn("upsert profile error:", upsertErr.message);

        // fetch again
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url")
          .eq("id", user.id)
          .single();
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (e: any) {
      console.error("loadProfile error", e);
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }

  // pick & upload avatar then update profile row
  async function pickAvatar() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      await uploadAvatar(uri);
    } catch (e: any) {
      console.error("pickAvatar error", e);
      Alert.alert("Error", "Could not pick avatar.");
    }
  }

  async function uriToFile(
    uri: string,
    fileName: string
  ): Promise<File | Blob> {
    if (Platform.OS === "web") {
      // @ts-ignore: web picker returns File[]
      const response = await fetch(uri);
      const blob = await response.blob();
      return new File([blob], fileName, { type: blob.type });
    } else {
      const response = await fetch(uri);
      return await response.blob();
    }
  }

  async function uploadAvatar(uri: string) {
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) throw new Error("Not authenticated");

      const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
      const filePath = `avatars/${user.id}/${Date.now()}.${ext}`;

      const fileOrBlob = await uriToFile(uri, `avatar.${ext}`);

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, fileOrBlob, {
          upsert: true,
          contentType: (fileOrBlob as any).type || "image/jpeg",
        });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      const publicUrl = publicData.publicUrl;

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      setProfile((p: any) => ({ ...p, avatar_url: publicUrl }));
    } catch (e: any) {
      console.error("uploadAvatar error", e);
      Alert.alert("Upload error", e.message || "Could not upload avatar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    // replace navigation to auth/login route in your app
    // navigation.replace("Auth");
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>No profile found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickAvatar}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={{ color: "#111" }}>Add</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.name}>{profile.full_name ?? profile.username}</Text>
      <Text style={styles.username}>@{profile.username}</Text>
      {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      <View style={{ height: 20 }} />

      <TouchableOpacity
        style={styles.button}
        onPress={() => (navigation as any).navigate("EditProfile")}
      >
        <Text style={styles.buttonText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.logout]}
        onPress={handleLogout}
      >
        <Text style={[styles.buttonText, { color: "#fff" }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  avatar: { width: 110, height: 110, borderRadius: 55, marginBottom: 12 },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "700" },
  username: { color: "#6b7280", marginBottom: 8 },
  bio: { textAlign: "center", color: "#374151", marginBottom: 12 },
  button: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  logout: { backgroundColor: "#ef4444" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
