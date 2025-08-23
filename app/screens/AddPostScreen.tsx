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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import uuid from "react-native-uuid";

interface Category {
  id: string;
  name: string;
  slug: string;
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
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (!error && data) {
      setCategories(data);
      if (data.length) setCategoryId(data[0].id);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      let uploadedUrl = null;

      if (image) {
        const fileExt = image.split(".").pop()?.toLowerCase() || "jpg,png";
        const fileName = `${uuid.v4()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Upload
        const img = await fetch(image);
        const blob = await img.blob();

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, blob, {
            contentType: "image/jpeg,image/png",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(filePath);

        uploadedUrl = urlData.publicUrl;
      }

      // Insert into DB
      const { error } = await supabase.from("listings").insert([
        {
          title,
          price: Number(price),
          location,
          category_id: categoryId,
          user_id: user.id,
          thumbnail_url: uploadedUrl,
          description: description,
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Post created successfully!");
      setTitle("");
      setPrice("");
      setLocation("");
      setCategoryId("");
      setImage(null);
      setDescription("");
    } catch (err: any) {
      console.error("Submit error:", err);
      Alert.alert("Error", err.message);
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
        <TouchableOpacity style={styles.secondary} onPress={pickImage}>
          <Text style={styles.secondaryText}>Pick Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={submit}>
          <Text style={styles.btnText}>Publish</Text>
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
  secondaryText: { color: "#2563eb", fontWeight: "700" },
});
