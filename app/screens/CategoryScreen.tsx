// screens/CategoryScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import ListingCardGrid from "@/components/mods/ListingCardGrid";
import { formatCount } from "@/lib/format";

type Props = { route: any; navigation: any };

export default function CategoryScreen({ route, navigation }: Props) {
  const { categoryId, categoryName } = route.params;
  const [filter, setFilter] = useState<
    "latest" | "oldest" | "most_liked" | "random"
  >("latest");
  const [listings, setListings] = useState<any[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategory();
  }, [filter, categoryId]);

  const fetchCategory = async () => {
    setLoading(true);
    try {
      // base fetch by category
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, thumbnail_url, created_at")
        .eq("category_id", categoryId)
        .limit(200);

      if (error) throw error;
      let arr = data || [];

      // compute likes map in bulk
      const ids = arr.map((r: any) => r.id);
      let localLikes: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: likeRows } = await supabase
          .from("listing_likes")
          .select("listing_id")
          .in("listing_id", ids);
        (likeRows || []).forEach((r: any) => {
          localLikes[r.listing_id] = (localLikes[r.listing_id] || 0) + 1;
        });
      }
      setLikesMap(localLikes);

      // apply filter
      if (filter === "latest") {
        arr = arr.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (filter === "oldest") {
        arr = arr.sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else if (filter === "most_liked") {
        arr = arr.sort(
          (a: any, b: any) => (localLikes[b.id] || 0) - (localLikes[a.id] || 0)
        );
      } else if (filter === "random") {
        arr = arr.sort(() => Math.random() - 0.5);
      }

      setListings(arr);
    } catch (e) {
      console.error("fetchCategory err", e);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{categoryName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterRow}>
        {(["latest", "oldest", "most_liked", "random"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text
              style={filter === f ? styles.filterTextActive : styles.filterText}
            >
              {f === "latest"
                ? "Latest"
                : f === "oldest"
                ? "Oldest"
                : f === "most_liked"
                ? "Most liked"
                : "Random"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 12 }}
          data={listings}
          numColumns={2}
          keyExtractor={(i: any) => i.id}
          renderItem={({ item }) => (
            <ListingCardGrid
              item={item}
              likes={likesMap[item.id] || 0}
              navigation={navigation}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: "wrap",
  },
  filterBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#edf2ff",
    marginRight: 8,
    marginBottom: 8,
  },
  filterBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterText: { color: "#374151", fontWeight: "700" },
  filterTextActive: { color: "#fff", fontWeight: "700" },
});
