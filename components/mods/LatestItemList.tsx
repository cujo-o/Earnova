// components/mods/LatestItemList.tsx  (or screens/LatestItemsList.tsx)
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Alert
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import { formatCount } from "@/lib/format";

interface Listing {
  id: string;
  title: string;
  price: number;
  thumbnail_url: string | null;
}

export default function LatestItemsList({ navigation }: any) {
  const { user } = useAuth();
  const [latest, setLatest] = useState<Listing[]>([]);
  const [likesMap, setLikesMap] = useState<
    Record<string, { count: number; liked: boolean }>
  >({});
  const [animMap] = useState<Record<string, Animated.Value>>({});

  useEffect(() => {
    fetchLatest();
  }, []);

  useEffect(() => {
    // initialize animated values
    latest.forEach((l) => {
      if (!animMap[l.id]) animMap[l.id] = new Animated.Value(1);
    });
  }, [latest]);

  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, price, thumbnail_url")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setLatest(data);
      // bulk fetch counts for these IDs
      const ids = data.map((d: any) => d.id);
      if (ids.length > 0) {
        const { data: counts, error: cErr } = await supabase
          .from("listing_likes")
          .select("listing_id, liker_id")
          .in("listing_id", ids);
        if (!cErr) {
          // build counts and liked flag for current user (if any)
          const map: Record<string, { count: number; liked: boolean }> = {};
          ids.forEach((id) => (map[id] = { count: 0, liked: false }));
          (counts || []).forEach((r: any) => {
            map[r.listing_id].count++;
            if (user && r.liker_id === user.id) map[r.listing_id].liked = true;
          });
          setLikesMap(map);
        }
      }
    }
  };

  const doLikeToggle = async (item: Listing) => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to like listings.");
      return;
    }

    const prev = likesMap[item.id] ?? { count: 0, liked: false };
    const optimistic = {
      ...prev,
      liked: !prev.liked,
      count: prev.liked ? prev.count - 1 : prev.count + 1,
    };
    setLikesMap((m) => ({ ...m, [item.id]: optimistic }));

    // animate
    const val = animMap[item.id] || new Animated.Value(1);
    animMap[item.id] = val;
    val.setValue(0.8);
    Animated.spring(val, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();

    try {
      if (!prev.liked) {
        const { error } = await supabase
          .from("listing_likes")
          .insert([{ listing_id: item.id, liker_id: user.id }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listing_likes")
          .delete()
          .eq("listing_id", item.id)
          .eq("liker_id", user.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error("doLikeToggle err", e);
      // revert
      setLikesMap((m) => ({ ...m, [item.id]: prev }));
    }
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const meta = likesMap[item.id] ?? { count: 0, liked: false };
    const scale = animMap[item.id] || new Animated.Value(1);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("ProductDetails", { productId: item.id })
        }
      >
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Text>No Img</Text>
          </View>
        )}
        <Text style={styles.title}>{item.title}</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.price}>
            {" "}
            ₦{Number(item.price).toLocaleString()}
          </Text>
          <TouchableOpacity
            onPress={() => doLikeToggle(item)}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={meta.liked ? "heart" : "heart-outline"}
                size={18}
                color={meta.liked ? "#ef4444" : "#6b7280"}
              />
            </Animated.View>
            <Text
              style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}
            >
              {formatCount(meta.count)}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Latest Listings</Text>
      <FlatList
        data={latest}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  header: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginLeft: 12 },
  card: {
    width: 140,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginRight: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  image: { width: "100%", height: 100, borderRadius: 8, marginBottom: 6 },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  title: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  price: { color: "#2563eb", fontWeight: "600" },
});
