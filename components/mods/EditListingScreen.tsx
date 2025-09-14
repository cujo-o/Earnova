import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker"; 
import * as FileSystem from "expo-file-system";
import { decode as base64Decode } from "base64-arraybuffer";
import uuid from "react-native-uuid";
import { supabase } from "@/lib/supabase";

interface Props {
  route: any;
  navigation: any;
}

export default function EditListingScreen({ route, navigation }: Props) {
  const { listingId } = route.params;

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchListing();
  }, []);

  const fetchListing = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("title, price, description, thumbnail_url")
      .eq("id", listingId)
      .single();

    if (error) {
      console.error(error);
      Alert.alert("Error fetching listing");
    } else {
      setTitle(data.title);
      setPrice(data.price.toString());
      setDescription(data.description || "");
      setThumbnail(data.thumbnail_url);
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission required", "We need access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setNewImage(result.assets[0].uri);
    }
  };

  const getFileExt = (uri: string) => {
    const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (m) return m[1].toLowerCase();
    return "jpg";
  };

  const uploadImageToStorage = async (uri: string) => {
    const bucket = "listing-thumbnails";
    const ext = getFileExt(uri).replace("jpeg", "jpg");
    const filename = `${uuid.v4()}.${ext}`;
    const path = `${listingId}/${filename}`;
    const mime = ext === "png" ? "image/png" : "image/jpeg";

    if (Platform.OS === "web") {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: mime,
        upsert: true,
      });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64Decode(base64);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer as any, {
          contentType: mime,
          upsert: true,
        });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      // fallback: fetch->blob
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: mime,
        upsert: true,
      });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      let imageUrl = thumbnail;
      if (newImage) {
        imageUrl = await uploadImageToStorage(newImage);
      }

      const { error } = await supabase
        .from("listings")
        .update({
          title,
          price: parseFloat(price),
          description,
          thumbnail_url: imageUrl,
        })
        .eq("id", listingId);

      if (error) throw error;

      Alert.alert("Success", "Listing updated successfully");
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Could not update listing");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit Listing</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Enter title"
      />

      <Text style={styles.label}>Price</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="Enter price"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Enter description"
        multiline
      />

      <Text style={styles.label}>Thumbnail</Text>
      {newImage || thumbnail ? (
        <Image
          source={{ uri: newImage || thumbnail || "" }}
          style={styles.image}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={{ color: "#888" }}>No image selected</Text>
        </View>
      )}

      <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
        <Text style={styles.secondaryBtnText}>
          {newImage ? "Change Image" : "Pick Image"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdate}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Update Listing</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f9fafb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: "#111827",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: "#fff",
  },
  textarea: {
    height: 120,
    textAlignVertical: "top",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginVertical: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginVertical: 12,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
