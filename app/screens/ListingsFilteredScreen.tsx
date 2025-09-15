// screens/ListingsFilteredScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import ListingCardGrid from "@/components/mods/ListingCardGrid";

export default function ListingsFilteredScreen({ route, navigation }: any) {
  const preset = route.params?.preset ?? null;
  const [filter, setFilter] = useState<
    "latest" | "oldest" | "most_liked" | "random"
  >(preset === "latest" ? "latest" : preset === "random" ? "random" : "latest");
  const [items, setItems] = useState<any[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [filter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("listings")
        .select("id,title,price,thumbnail_url,created_at")
        .limit(500);
      if (!data) {
        setItems([]);
        setLoading(false);
        return;
      }
      let arr = data;

      const ids = arr.map((r: any) => r.id);
      const likes: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: likeRows } = await supabase
          .from("listing_likes")
          .select("listing_id")
          .in("listing_id", ids);
        (likeRows || []).forEach((r: any) => {
          likes[r.listing_id] = (likes[r.listing_id] || 0) + 1;
        });
      }
      setLikesMap(likes);

      if (filter === "latest")
        arr = arr.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      else if (filter === "oldest")
        arr = arr.sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      else if (filter === "most_liked")
        arr = arr.sort(
          (a: any, b: any) => (likes[b.id] || 0) - (likes[a.id] || 0)
        );
      else if (filter === "random") arr = arr.sort(() => Math.random() - 0.5);

      setItems(arr);
    } catch (e) {
      console.warn("fetchAll err", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "800", fontSize: 18 }}>Listings</Text>
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

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        renderItem={({ item }) => (
          <ListingCardGrid
            item={item}
            navigation={navigation}
            likes={likesMap[item.id] || 0}
          />
        )}
      />
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
    borderColor: "#eef2ff",
    marginRight: 8,
    marginBottom: 8,
  },
  filterBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterText: { color: "#374151", fontWeight: "700" },
  filterTextActive: { color: "#fff", fontWeight: "700" },
});
