import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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

  useEffect(() => {
    fetchListing();
  }, []);

  const fetchListing = async () => {
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
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setThumbnail(asset.uri);
    }
  };

  const handleUpdate = async () => {
    let imageUrl = thumbnail;

    // If user picked a new image, upload to Supabase Storage
    if (thumbnail && thumbnail.startsWith("file://")) {
      const ext = thumbnail.split(".").pop();
      const fileName = `${uuid.v4()}.${ext}`;
      const filePath = `thumbnails/${fileName}`;

      const img = await fetch(thumbnail);
      const blob = await img.blob();

      const { error: uploadError } = await supabase.storage
        .from("listing-thumbnails")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        Alert.alert("Error uploading image");
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("listing-thumbnails")
        .getPublicUrl(filePath);

      imageUrl = publicUrl.publicUrl;
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

    if (error) {
      console.error(error);
      Alert.alert("Error updating listing");
    } else {
      Alert.alert("Listing updated successfully");
      navigation.goBack();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        style={[styles.input, { height: 100 }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Enter description"
        multiline
      />

      <Text style={styles.label}>Thumbnail</Text>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.image} />
      ) : (
        <Text>No Image Selected</Text>
      )}
      <TouchableOpacity onPress={pickImage} style={styles.button}>
        <Text style={styles.buttonText}>Pick Image</Text>
      </TouchableOpacity>

      <Button title="Update Listing" onPress={handleUpdate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
