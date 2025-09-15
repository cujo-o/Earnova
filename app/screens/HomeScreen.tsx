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
import LatestItemsList from "@/components/mods/LatestItemList";
import ExploreGrid from "@/components/mods/ExploreGrid";

export default function HomeScreen({ navigation }: any) {
  const [categories, setCategories] = useState<any[]>([]);
  const [sliderImages, setSliderImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: cats } = await supabase
          .from("categories")
          .select("*")
          .order("name");
        if (cats) setCategories(cats);

        const { data: slides } = await supabase
          .from("slider_images")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);
        if (slides) setSliderImages(slides);
      } catch (e) {
        console.warn("home fetch err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onCategoryPress = (cat: any) => {
    navigation.navigate("Category", {
      categoryId: cat.id,
      categoryName: cat.name,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.header}>Earnova</Text>
      </View>

      {/* Slider section */}
      <FlatList
        data={sliderImages}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <Image source={{ uri: item.image_url }} style={styles.sliderImage} />
        )}
        style={styles.slider}
        contentContainerStyle={{ paddingLeft: 12 }}
      />

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Explore")}>
            <Text style={styles.seeMore}>See all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => onCategoryPress(item)}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.categoryImage}
                />
              ) : null}
              <Text style={styles.categoryText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingLeft: 12, paddingRight: 12 }}
        />
      </View>

      {/* Middle: Explore (randomized grid) */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("ListingsFiltered", { preset: "random" })
            }
          >
            <Text style={styles.seeMore}>See more</Text>
          </TouchableOpacity>
        </View>

        <ExploreGrid navigation={navigation} />
      </View>

      {/* Latest */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Latest</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("ListingsFiltered", { preset: "latest" })
            }
          >
            <Text style={styles.seeMore}>See more</Text>
          </TouchableOpacity>
        </View>

        <LatestItemsList navigation={navigation} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerRow: { padding: 16 },
  header: { fontSize: 28, fontWeight: "800", color: "#111827" },
  slider: { marginBottom: 18, height: 150 },
  sliderImage: {
    width: 320,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#f3f4f6",
  },
  section: { marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeMore: { color: "#2563eb", fontWeight: "700" },
  categoryCard: {
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef2ff",
    elevation: 1,
  },
  categoryText: { fontWeight: "700" },
  categoryImage: { width: 56, height: 56, borderRadius: 10, marginBottom: 8 },
});
