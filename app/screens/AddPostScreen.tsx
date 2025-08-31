// screens/AddPostScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as base64Decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import uuid from "react-native-uuid";

interface Category {
  id: string;
  name: string;
  slug?: string;
}

export default function AddPostScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) {
        console.warn("loadCategories error:", error);
        return;
      }
      if (data) {
        setCategories(data);
        if (data.length && !categoryId) setCategoryId(data[0].id);
      }
    } catch (e) {
      console.warn("loadCategories unexpected error", e);
    }
  };

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission required",
          "We need permission to access your photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // works on web + native
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn("pickImage error", e);
      Alert.alert("Image error", "Could not open image picker.");
    }
  };

  const getFileExt = (uri: string) => {
    // handles file.jpg?params and data URIs fallback
    const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (m) return m[1].toLowerCase();
    if (uri.startsWith("data:")) {
      const t = uri.match(/data:(image\/[a-zA-Z]+);base64,/);
      if (t) return t[1].split("/")[1];
    }
    return "jpg";
  };

  const makeFilename = (ext: string) => {
    // uuid.v4 may be a function or value depending on package; fallback if needed
    let id: string;
    try {
      // @ts-ignore
      id = (typeof uuid.v4 === "function" ? uuid.v4() : uuid.v4) as string;
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    return `${id}.${ext}`;
  };

  // unified upload that picks method depending on platform
  const uploadImageToStorage = async (uri: string, uid: string) => {
    const bucket = "listing-images";
    const ext = getFileExt(uri).replace("jpeg", "jpg");
    const filename = makeFilename(ext);
    const path = `${uid}/${filename}`;
    const mime = ext === "png" ? "image/png" : "image/jpeg";

    // WEB flow: fetch->blob then upload blob
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

    // NATIVE flow: read base64 -> ArrayBuffer -> upload
    try {
      // expo-file-system read as base64 (works consistently on Android/iOS)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64Decode(base64);

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
      // Try a fallback: attempt fetch->blob (some RN runtimes support it)
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

  const submit = async () => {
    if (!title || !price || !categoryId) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be logged in to post");
      return;
    }
    setLoading(true);

    try {
      let uploadedUrl: string | null = null;

      if (image) {
        uploadedUrl = await uploadImageToStorage(image, user.id);
      }

      const { error } = await supabase.from("listings").insert([
        {
          title,
          price: Number(price),
          location: location || null,
          category_id: categoryId,
          user_id: user.id,
          thumbnail_url: uploadedUrl,
          description: description || null,
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Post created successfully!");
      setTitle("");
      setPrice("");
      setLocation("");
      setDescription("");
      setImage(null);
      if (categories.length) setCategoryId(categories[0].id);
    } catch (err: any) {
      console.error("Submit error:", err);
      let message = err?.message ?? "Unknown error";
      if (message.includes("Network request failed"))
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.header}>Create Listing</Text>
        <Text style={styles.label}>Category</Text>
        <View style={styles.catRow}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.catBtn,
                categoryId === c.id && styles.catBtnActive,
              ]}
              onPress={() => setCategoryId(c.id)}
            >
              <Text
                style={[
                  styles.catText,
                  categoryId === c.id && styles.catTextActive,
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Price (NGN)"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          style={styles.input}
        />
        <TextInput
          placeholder="Location (optional)"
          value={location}
          onChangeText={setLocation}
          style={styles.input}
        />
        <TextInput
          placeholder="Description"
          multiline
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { minHeight: 100 }]}
        />

        {image ? (
          <Image
            source={{ uri: image }}
            style={{
              width: "100%",
              height: 180,
              borderRadius: 10,
              marginBottom: 12,
            }}
          />
        ) : null}
        <TouchableOpacity
          style={styles.secondary}
          onPress={pickImage}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Pick Image</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btn}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? "Publishing..." : "Publish"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  label: { fontWeight: "700", marginTop: 8, marginBottom: 6 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  catBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  catBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  catText: { color: "#111827" },
  catTextActive: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  secondary: {
    borderWidth: 1,
    borderColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryText: {
    color: "#2563eb",
    fontWeight: "700",
  },
});
