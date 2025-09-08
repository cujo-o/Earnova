// screens/EditProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
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
import { Platform } from "react-native";

export default function EditProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [searchingRoommate, setSearchingRoommate] = useState(false);
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");
  const [religion, setReligion] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) {
      Alert.alert("Not signed in");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      console.error("load profile error", error);
    } else if (data) {
      setProfile(data);
      setUsername(data.username || "");
      setFullName(data.full_name || "");
      setAvatarUri(data.avatar_url || null);
      setSearchingRoommate(!!data.searching_roommate);
      setLocation(data.location || "");
      setAge(data.age ? String(data.age) : "");
      setReligion(data.religion || "");
      setDepartment(data.department || "");
      setBio(data.bio || "");
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    setAvatarUri(res.assets[0].uri);
  };

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

  const uploadAvatarIfNeeded = async (uri: string | null) => {
    if (!uri) return profile?.avatar_url ?? null;
    if (uri.startsWith("http")) return uri;

    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) throw new Error("Not signed in");

    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const path = `avatars/${uid}/${Date.now()}.${ext}`;

    const fileOrBlob = await uriToFile(uri, `avatar.${ext}`);

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, fileOrBlob, {
        upsert: true,
        contentType: (fileOrBlob as any).type || "image/jpeg",
      });
    if (error) throw error;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) throw new Error("Not signed in");

      // username uniqueness check
      if (!username.trim()) {
        Alert.alert("Validation", "Username cannot be empty");
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .limit(1);
      if (existing && existing.length > 0 && existing[0].id !== uid) {
        Alert.alert("Username taken", "Choose another username.");
        setLoading(false);
        return;
      }

      const avatar_url = await uploadAvatarIfNeeded(avatarUri);
      const ageNum = age ? parseInt(age, 10) : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          full_name: fullName.trim() || null,
          avatar_url: avatar_url || null,
          searching_roommate: !!searchingRoommate,
          location: location || null,
          age: ageNum,
          religion: religion || null,
          department: department || null,
          bio: bio || null,
        })
        .eq("id", uid);

      if (error) throw error;
      Alert.alert("Saved", "Profile updated");
      navigation.goBack();
    } catch (e: any) {
      console.error("save profile error", e);
      Alert.alert("Error", e.message || "Could not save");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity
        onPress={pickImage}
        style={{ alignSelf: "center", marginBottom: 12 }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        ) : (
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "#f3f4f6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text>Add</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={{ fontWeight: "700" }}>Username</Text>
      <TextInput
        style={s.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Full name</Text>
      <TextInput style={s.input} value={fullName} onChangeText={setFullName} />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>
        Searching for roommate
      </Text>
      <TouchableOpacity
        onPress={() => setSearchingRoommate(!searchingRoommate)}
        style={[
          s.toggleBtn,
          searchingRoommate && s.toggleActive,
          { marginTop: 8 },
        ]}
      >
        <Text style={searchingRoommate ? s.toggleTextActive : s.toggleText}>
          {searchingRoommate ? "Yes" : "No"}
        </Text>
      </TouchableOpacity>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Location</Text>
      <TextInput style={s.input} value={location} onChangeText={setLocation} />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Age</Text>
      <TextInput
        style={s.input}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Religion</Text>
      <TextInput style={s.input} value={religion} onChangeText={setReligion} />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Department</Text>
      <TextInput
        style={s.input}
        value={department}
        onChangeText={setDepartment}
      />

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Bio</Text>
      <TextInput
        style={[s.input, { minHeight: 80 }]}
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={handleSave}>
        <Text style={s.btnText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
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
});
