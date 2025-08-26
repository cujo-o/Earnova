// screens/EditProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

export default function EditProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) {
        Alert.alert("Not signed in");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("username, full_name, bio, avatar_url")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("profile select error:", error.message);
      }

      if (!data) {
        // create empty profile if missing
        const defaultUsername = user.email ? user.email.split("@")[0] : user.id;
        await supabase
          .from("profiles")
          .upsert({ id: user.id, username: defaultUsername });
        setUsername(defaultUsername);
        setFullName("");
        setBio("");
        setInitialAvatarUrl(null);
      } else {
        setUsername(data.username ?? "");
        setFullName(data.full_name ?? "");
        setBio(data.bio ?? "");
        setInitialAvatarUrl(data.avatar_url ?? null);
      }
    } catch (e: any) {
      console.error("load profile error", e);
      Alert.alert("Error", "Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  async function pickImage() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (res.canceled) return;
      setAvatarUri(res.assets[0].uri);
    } catch (e: any) {
      console.error("pick image error", e);
    }
  }

  async function uploadAvatarIfNeeded(uri: string | null) {
    if (!uri) return initialAvatarUrl;
    // if uri is already a URL (starts with http) return it
    if (uri.startsWith("http")) return uri;

    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (!user) throw new Error("Not authenticated");

    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;

    const res = await fetch(uri);
    const blob = await res.blob();

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
      });

    if (error) throw error;

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function handleSave() {
    setLoading(true);
    try {
      // username uniqueness check
      if (!username.trim()) {
        Alert.alert("Validation", "Username cannot be empty");
        setLoading(false);
        return;
      }

      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) {
        Alert.alert("Not signed in");
        setLoading(false);
        return;
      }

      // check username taken by another user
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .limit(1);

      if (existing && existing.length > 0 && existing[0].id !== user.id) {
        Alert.alert("Username taken", "Please pick another username");
        setLoading(false);
        return;
      }

      const avatarUrl = await uploadAvatarIfNeeded(avatarUri);

      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          full_name: fullName.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id);

      if (error) {
        console.error("profile update error", error);
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }

      Alert.alert("Saved", "Profile updated");
      navigation.goBack();
    } catch (e: any) {
      console.error("save profile error", e);
      Alert.alert("Error", e.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={pickImage}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : initialAvatarUrl ? (
          <Image source={{ uri: initialAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text>Add</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignSelf: "center",
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontWeight: "700", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700" },
});
