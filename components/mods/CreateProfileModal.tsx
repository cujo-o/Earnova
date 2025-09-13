// components/mods/CreateProfileModal.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

import * as FileSystem from "expo-file-system";
import { decode as base64Decode } from "base64-arraybuffer";
import uuid from "react-native-uuid";

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
  // form fields
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [searchingRoommate, setSearchingRoommate] = useState(true);
  const [location, setLocation] = useState("");
  const [age, setAge] = useState<string>("");
  const [religion, setReligion] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // 0..3
  const steps = useMemo(
    () => [
      { id: 0, label: "Account" },
      { id: 1, label: "Roommate" },
      { id: 2, label: "Details" },
      { id: 3, label: "Bio & Save" },
    ],
    []
  );

  // reset when modal closes
  useEffect(() => {
    if (!visible) {
      resetAll();
    }
  }, [visible]);

  const resetAll = () => {
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
    setStep(0);
  };

  // Image picking
  const pickImage = async () => {
    try {
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

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setAvatarUri(res.assets[0].uri);
      }
    } catch (e: any) {
      console.warn("pickImage error", e);
      Alert.alert("Image error", "Could not open image picker.");
    }
  };

  // utilities for upload
  const getFileExt = (uri: string) => {
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
      id =
        typeof uuid.v4 === "function" ? (uuid.v4() as string) : String(uuid.v4);
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    return `${id}.${ext}`;
  };

  const uploadImageToStorage = async (uri: string, uid: string) => {
    const bucket = "avatars";
    const ext = getFileExt(uri).replace("jpeg", "jpg");
    const filename = makeFilename(ext);
    const path = `${uid}/${filename}`;
    const mime = ext === "png" ? "image/png" : "image/jpeg";

    // Web: fetch -> blob
    if (Platform.OS === "web") {
      try {
        const resp = await fetch(uri);
        const blob = await resp.blob();

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType: mime, upsert: true });

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch (err: any) {
        console.warn("upload (web) failed:", err);
        throw new Error(err?.message || "Web upload failed.");
      }
    }

    // Native: try expo-file-system base64 -> ArrayBuffer
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64Decode(base64);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer as any, { contentType: mime, upsert: true });

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      console.warn("upload (native) failed:", err);
      // fallback: fetch -> blob
      try {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const { error: uploadError2 } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType: mime, upsert: true });
        if (uploadError2) throw uploadError2;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      } catch (fallbackErr: any) {
        console.warn("upload fallback failed:", fallbackErr);
        throw new Error(fallbackErr?.message || "Native upload failed.");
      }
    }
  };

  const uploadAvatarIfNeeded = async (uri: string | null) => {
    if (!uri) return null;
    if (uri.startsWith("http")) return uri;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) throw new Error("Not signed in");
    const publicUrl = await uploadImageToStorage(uri, uid);
    return publicUrl;
  };

  const isUsernameTaken = async (value: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", value)
      .limit(1);
    if (error) {
      console.warn("username check error", error);
      return true;
    }
    return data && data.length > 0;
  };

  const handleFinalSave = async () => {
    // called from final step
    setSaving(true);
    try {
      if (!username.trim()) {
        Alert.alert("Validation", "Please choose a username.");
        setSaving(false);
        return;
      }

      // check username uniqueness but allow if existing row is this userId
      const { data: existingRows } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .limit(1);

      if (
        existingRows &&
        existingRows.length > 0 &&
        existingRows[0].id !== userId
      ) {
        Alert.alert("Username taken", "Please choose another username.");
        setSaving(false);
        return;
      }

      let avatar_url: string | null = null;
      if (avatarUri) avatar_url = await uploadAvatarIfNeeded(avatarUri);

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

      // success
      onCreated();
    } catch (e: any) {
      console.error("create profile error", e);
      if (e?.message && e.message.includes("Network request failed")) {
        Alert.alert(
          "Upload failed",
          "Network failed while uploading. Check your connection and try again."
        );
      } else {
        Alert.alert("Error", e.message || "Could not create profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };
  const onBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const progress = Math.round(((step + 1) / steps.length) * 100);

  // Step renderers
  const renderStep0 = () => (
    <>
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
    </>
  );

  const renderStep1 = () => (
    <>
      <Text style={{ fontWeight: "700", marginBottom: 8 }}>
        Looking for roommate?
      </Text>
      <View style={{ flexDirection: "row" }}>
        <TouchableOpacity
          style={[s.toggleBtn, searchingRoommate && s.toggleActive]}
          onPress={() => setSearchingRoommate(true)}
        >
          <Text style={searchingRoommate ? s.toggleTextActive : s.toggleText}>
            Yes
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
          <Text style={!searchingRoommate ? s.toggleTextActive : s.toggleText}>
            No
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
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
    </>
  );

  const renderStep3 = () => (
    <>
      <TextInput
        placeholder="Short bio"
        style={[s.input, { minHeight: 100 }]}
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Review</Text>
        <View
          style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 8 }}
        >
          <Text style={{ fontWeight: "700" }}>{fullName || username}</Text>
          {!!location && <Text style={{ color: "#6b7280" }}>{location}</Text>}
          {!!department && (
            <Text style={{ color: "#6b7280" }}>{department}</Text>
          )}
          {!!bio && <Text style={{ marginTop: 8 }}>{bio}</Text>}
        </View>
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Header / progress */}
          <View style={s.header}>
            <Text style={s.title}>Create your profile</Text>
            <View style={s.progressWrap}>
              <View style={[s.progressBar, { width: `${progress}%` }]} />
            </View>
            <Text style={{ color: "#6b7280", fontSize: 12 }}>
              Step {step + 1} of {steps.length} — {steps[step].label}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={{ marginTop: 12 }}>
              {step === 0 && renderStep0()}
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </View>

            {/* Controls */}
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <TouchableOpacity
                style={[s.btnAlt, { flex: 1 }]}
                onPress={() => {
                  if (step === 0) {
                    // skip behavior if not required
                    if (!requireComplete) {
                      onCreated();
                    } else {
                      // just reset or close?
                      Alert.alert("Required", "Please complete the profile.");
                    }
                  } else {
                    onBack();
                  }
                }}
                disabled={saving}
              >
                <Text style={s.btnAltText}>
                  {step === 0 ? (requireComplete ? "Cancel" : "Skip") : "Back"}
                </Text>
              </TouchableOpacity>

              {step < steps.length - 1 ? (
                <TouchableOpacity
                  style={[s.btn, { flex: 1, marginLeft: 8 }]}
                  onPress={async () => {
                    // basic per-step validation
                    if (step === 0) {
                      if (!username.trim()) {
                        Alert.alert("Validation", "Username is required.");
                        return;
                      }
                      // quick uniqueness check (not blocking if DB error)
                      const taken = await isUsernameTaken(username.trim());
                      if (taken) {
                        // check if username belongs to this userId; allow if so
                        const { data: rows } = await supabase
                          .from("profiles")
                          .select("id")
                          .eq("username", username.trim())
                          .limit(1);
                        if (rows && rows.length > 0 && rows[0].id !== userId) {
                          Alert.alert(
                            "Username taken",
                            "Please choose another username."
                          );
                          return;
                        }
                      }
                    }
                    onNext();
                  }}
                >
                  <Text style={s.btnText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.btn, { flex: 1, marginLeft: 8 }]}
                  onPress={handleFinalSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.btnText}>Save profile</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    flex: 1,
    marginTop: 80,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
  },
  header: { marginBottom: 8 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  progressWrap: {
    height: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    marginTop: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#2563eb",
  },
  avatarWrap: { alignSelf: "center", marginBottom: 8, marginTop: 8 },
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
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnAltText: { color: "#111", fontWeight: "700" },
});
