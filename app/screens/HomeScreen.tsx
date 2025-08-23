import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { supabase } from "@/lib/supabase";
import LatestItemList from "@/components/mods/LatestItemList";

export default function HomeScreen({ navigation }: any) {
  const [categories, setCategories] = useState<any[]>([]);
  const [sliderImages, setSliderImages] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchSliderImages();
  }, []);

  const fetchCategories = async () => {
    let { data } = await supabase.from("categories").select("*");
    if (data) setCategories(data);
  };

  const fetchSliderImages = async () => {
    let { data } = await supabase.from("slider_images").select("*");
    if (data) setSliderImages(data);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Earnova</Text>

      {/* Slider */}
      <FlatList
        data={sliderImages}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Image source={{ uri: item.image_url }} style={styles.sliderImage} />
        )}
        keyExtractor={(item) => item.id.toString()}
        style={styles.slider}
      />

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <FlatList
          data={categories}
          horizontal
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.categoryCard}>
              <Text style={styles.categoryText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      </View>

      {/* Latest Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest Items</Text>
        <LatestItemList navigation={navigation} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  slider: { marginBottom: 20 },
  sliderImage: { width: 300, height: 150, borderRadius: 10, marginRight: 10 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  categoryCard: {
    backgroundColor: "#f1f1f1",
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
  },
  categoryText: { fontSize: 14, fontWeight: "500" },
});
