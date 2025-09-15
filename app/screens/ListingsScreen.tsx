// screens/ListingScreen.tsx  (updated renderItem only + fetch likes counts)
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import { formatCount } from "@/lib/format";

interface Listing {
  id: string;
  title: string;
  price: number;
  location: string | null;
  thumbnail_url: string | null;
  categories?: { name: string } | null;
}

export default function ListingScreen({ navigation }: any) {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; liked: boolean }>>({});
  const animMapRef = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    fetchListings();
  }, [user]);

  const fetchListings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, price, location, thumbnail_url, categories(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setListings([]);
      setLoading(false);
      return;
    }
    setListings(
      (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        price: d.price,
        location: d.location,
        thumbnail_url: d.thumbnail_url,
        categories: Array.isArray(d.categories) && d.categories.length > 0
          ? { name: String(d.categories[0].name) }
          : null,
      }))
    );

    // fetch likes for these listings and the user's like
    const ids = (data || []).map((d: any) => d.id);
    if (ids.length === 0) {
      setLikesMap({});
      setLoading(false);
      return;
    }

    const { data: likesRows, error: lErr } = await supabase
      .from("listing_likes")
      .select("listing_id, liker_id")
      .in("listing_id", ids);

    if (lErr) {
      console.warn("likes fetch err", lErr);
      setLikesMap({});
    } else {
      const map: Record<string, { count: number; liked: boolean }> = {};
      ids.forEach((id) => (map[id] = { count: 0, liked: false }));
      (likesRows || []).forEach((r: any) => {
        map[r.listing_id].count++;
        if (user && r.liker_id === user.id) map[r.listing_id].liked = true;
      });
      setLikesMap(map);
    }
    setLoading(false);
  };

  const toggleLike = async (item: Listing) => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to like listings.");
      return;
    }
    const prev = likesMap[item.id] ?? { count: 0, liked: false };
    setLikesMap((m) => ({ ...m, [item.id]: { count: prev.liked ? prev.count - 1 : prev.count + 1, liked: !prev.liked } }));

    // animate
    const anim = animMapRef[item.id] || new Animated.Value(1);
    animMapRef[item.id] = anim;
    anim.setValue(0.8);
    Animated.spring(anim, { toValue: 1, friction: 6, useNativeDriver: true }).start();

    try {
      if (!prev.liked) {
        const { error } = await supabase.from("listing_likes").insert([{ listing_id: item.id, liker_id: user.id }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("listing_likes").delete().eq("listing_id", item.id).eq("liker_id", user.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error("toggleLike", e);
      // revert on error
      setLikesMap((m) => ({ ...m, [item.id]: prev }));
    }
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const meta = likesMap[item.id] ?? { count: 0, liked: false };
    const anim = animMapRef[item.id] || new Animated.Value(1);
    animMapRef[item.id] = anim;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("ProductDetails", { productId: item.id })}
      >
        {item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.noImage]}><Text>No Image</Text></View>}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}> ₦{Number(item.price).toLocaleString()}</Text>
          <Text style={styles.meta}>{item.categories?.name ?? "Uncategorized"} • {item.location || "Unknown"}</Text>
        </View>

        <TouchableOpacity style={{ padding: 8 }} onPress={() => toggleLike(item)}>
          <Animated.View style={{ transform: [{ scale: anim }] }}>
            <Ionicons name={meta.liked ? "heart" : "heart-outline"} size={18} color={meta.liked ? "#ef4444" : "#6b7280"} />
          </Animated.View>
          <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>{formatCount(meta.count)}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <FlatList data={listings} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ padding: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  thumbnail: { width: 100, height: 100 },
  noImage: { justifyContent: "center", alignItems: "center", backgroundColor: "#e5eeb" },
  cardContent: { flex: 1, padding: 10, justifyContent: "center" },
  title: { fontWeight: "700", fontSize: 16, marginBottom: 4 },
  price: { color: "#2563eb", fontWeight: "600", marginBottom: 2 },
  meta: { fontSize: 12, color: "#6b7280" },
});
