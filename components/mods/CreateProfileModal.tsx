// components/mods/CreateProfileModal.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

type Props = {
  visible: boolean;
  onCreated: () => void; // called when profile successfully created
  userId: string;
  requireComplete?: boolean; // if true, disable Skip
};

export default function CreateProfileModal({
  visible,
  onCreated,
  userId,
  requireComplete = true,
}: Props) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [searchingRoommate, setSearchingRoommate] = useState(true);
  const [location, setLocation] = useState("");
  const [age, setAge] = useState<string>("");
  const [religion, setReligion] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      // reset on close/hide
      setUsername("");
      setFullName("");
      setAvatarUri(null);
      setSearchingRoommate(true);
      setLocation("");
      setAge("");
      setReligion("");
      setDepartment("");
      setBio("");
      setSaving(false);
    }
  }, [visible]);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      setAvatarUri(res.assets[0].uri);
    } catch (e) {
      console.warn("pickImage err", e);
    }
  };

  const uploadAvatar = async (uri: string) => {
    const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
    const path = `avatars/${userId}/${Date.now()}.${ext}`;
    const resp = await fetch(uri);
    const blob = await resp.blob();

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
      });

    if (uploadErr) throw uploadErr;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const isUsernameTaken = async (value: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", value)
      .limit(1);
    if (error) {
      console.warn("username check error", error);
      return true; // be conservative
    }
    return data && data.length > 0;
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert("Validation", "Please choose a username.");
      return;
    }
    setSaving(true);
    try {
      // Check username uniqueness (DB also has unique constraint)
      const taken = await isUsernameTaken(username.trim());
      // If editing existing profile, allow same username if it's yours. But here we force create unique.
      if (taken) {
        Alert.alert("Username taken", "Please choose another username.");
        setSaving(false);
        return;
      }

      let avatar_url: string | null = null;
      if (avatarUri) {
        avatar_url = await uploadAvatar(avatarUri);
      }

      const ageNum = age ? parseInt(age, 10) : null;

      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          username: username.trim(),
          full_name: fullName.trim() || null,
          avatar_url,
          searching_roommate: !!searchingRoommate,
          location: location || null,
          age: ageNum,
          religion: religion || null,
          department: department || null,
          bio: bio || null,
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      // success: tell parent to re-check profile and hide modal
      onCreated();
    } catch (e: any) {
      console.error("create profile error", e);
      Alert.alert("Error", e.message || "Could not create profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.backdrop}>
        <ScrollView contentContainerStyle={s.sheet}>
          <Text style={s.title}>Create your profile</Text>

          <TouchableOpacity onPress={pickImage} style={s.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={{ color: "#444" }}>Add photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            placeholder="Username (unique)"
            style={s.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            placeholder="Full name"
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
          />

          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
          >
            <TouchableOpacity
              style={[s.toggleBtn, searchingRoommate && s.toggleActive]}
              onPress={() => setSearchingRoommate(true)}
            >
              <Text
                style={searchingRoommate ? s.toggleTextActive : s.toggleText}
              >
                Looking for roommate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.toggleBtn,
                !searchingRoommate && s.toggleActive,
                { marginLeft: 8 },
              ]}
              onPress={() => setSearchingRoommate(false)}
            >
              <Text
                style={!searchingRoommate ? s.toggleTextActive : s.toggleText}
              >
                Not searching
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Location (city)"
            style={s.input}
            value={location}
            onChangeText={setLocation}
          />
          <TextInput
            placeholder="Age"
            style={s.input}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="Religion"
            style={s.input}
            value={religion}
            onChangeText={setReligion}
          />
          <TextInput
            placeholder="Department"
            style={s.input}
            value={department}
            onChangeText={setDepartment}
          />
          <TextInput
            placeholder="Short bio"
            style={[s.input, { minHeight: 80 }]}
            value={bio}
            onChangeText={setBio}
            multiline
          />

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <TouchableOpacity
              style={[s.btn, { flex: 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Save profile</Text>
              )}
            </TouchableOpacity>

            {!requireComplete && (
              <TouchableOpacity
                style={[s.btnAlt, { marginLeft: 8 }]}
                onPress={onCreated}
                disabled={saving}
              >
                <Text style={s.btnAltText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    padding: 20,
    backgroundColor: "#fff",
    marginTop: 80,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  avatarWrap: { alignSelf: "center", marginBottom: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  toggleBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  toggleActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  toggleText: { color: "#374151", fontWeight: "700" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  btn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  btnAlt: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnAltText: { color: "#111", fontWeight: "700" },
});
