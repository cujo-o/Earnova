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
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

import * as FileSystem from "expo-file-system";
import { decode as base64Decode } from "base64-arraybuffer";
import uuid from "react-native-uuid";

export default function EditProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null); // can be local uri or public url
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
    try {
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
    } catch (e) {
      console.error("load profile unexpected error", e);
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  // open image picker
  const pickImage = async () => {
    try {
      // request permission on native platforms
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Permission required",
            "We need permission to access your photos."
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn("pickImage error", e);
      Alert.alert("Image error", "Could not open image picker.");
    }
  };

  const getFileExt = (uri: string) => {
    // handles file.jpg?params and data URI fallback
    const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (m) return m[1].toLowerCase();
    if (uri.startsWith("data:")) {
      const t = uri.match(/data:(image\/[a-zA-Z]+);base64,/);
      if (t) return t[1].split("/")[1];
    }
    return "jpg";
  };

  const makeFilename = (ext: string) => {
    let id: string;
    try {
      // react-native-uuid provides v4 as a function
      id =
        typeof uuid.v4 === "function" ? (uuid.v4() as string) : String(uuid.v4);
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    return `${id}.${ext}`;
  };

  // unified storage uploader (web + native)
  const uploadImageToStorage = async (uri: string, uid: string) => {
    const bucket = "avatars";
    const ext = getFileExt(uri).replace("jpeg", "jpg");
    const filename = makeFilename(ext);
    const path = `${uid}/${filename}`;
    const mime = ext === "png" ? "image/png" : "image/jpeg";

    // WEB flow: fetch -> blob -> upload
    if (Platform.OS === "web") {
      try {
        const resp = await fetch(uri);
        const blob = await resp.blob();

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, blob, {
            contentType: mime,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch (err: any) {
        console.warn("upload (web) failed:", err);
        throw new Error(err?.message || "Web upload failed.");
      }
    }

    // NATIVE flow: try expo-file-system -> base64 -> ArrayBuffer upload
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64Decode(base64);

      // supabase-js accepts ArrayBuffer/Uint8Array
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer as any, {
          contentType: mime,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      console.warn("upload (native) failed:", err);
      // fallback: try fetch -> blob (some RN environments support fetch on file://)
      try {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const { error: uploadError2 } = await supabase.storage
          .from(bucket)
          .upload(path, blob, {
            contentType: mime,
            upsert: true,
          });
        if (uploadError2) throw uploadError2;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch (fallbackErr: any) {
        console.warn("upload fallback failed:", fallbackErr);
        throw new Error(fallbackErr?.message || "Native upload failed.");
      }
    }
  };

  // wrapper used by save routine
  const uploadAvatarIfNeeded = async (uri: string | null) => {
    if (!uri) return profile?.avatar_url ?? null;
    if (uri.startsWith("http")) return uri;

    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) throw new Error("Not signed in");

    const publicUrl = await uploadImageToStorage(uri, uid);
    return publicUrl;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) throw new Error("Not signed in");

      // username validation
      if (!username.trim()) {
        Alert.alert("Validation", "Username cannot be empty");
        setLoading(false);
        return;
      }

      // check uniqueness (allow same username if it's your existing row)
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

      // upload avatar if needed
      let avatar_url = await uploadAvatarIfNeeded(avatarUri);
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
      // update local state so UI reflects public avatar URL
      setProfile((p: any) => ({ ...p, avatar_url }));
      setAvatarUri(avatar_url);
      navigation.goBack();
    } catch (e: any) {
      console.error("save profile error", e);
      // provide friendly fallback message for network/storage issues
      if (e?.message && e.message.includes("Network request failed")) {
        Alert.alert(
          "Upload failed",
          "Network failed while uploading. Check your connection and try again."
        );
      } else {
        Alert.alert("Error", e.message || "Could not save");
      }
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
