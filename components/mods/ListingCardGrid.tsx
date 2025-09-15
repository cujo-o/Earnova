import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/format";

export default function ListingCardGrid({
  item,
  navigation,
  compact = false,
  likes = 0,
}: any) {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(likes || 0);
  const [liked, setLiked] = useState<boolean>(false);
  const [anim] = useState(new Animated.Value(1));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!likes) {
        // fetch count & whether current user liked
        try {
          const { data } = await supabase
            .from("listing_likes")
            .select("liker_id")
            .eq("listing_id", item.id);
          if (!mounted) return;
          setCount(data?.length ?? 0);
          if (user)
            setLiked((data || []).some((r: any) => r.liker_id === user.id));
        } catch (e) {
          console.warn("listing likes fetch err", e);
        }
      } else {
        setCount(likes);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleLike = async () => {
    if (!user) {
      return navigation?.navigate?.("Auth");
    }
    const prev = { count, liked };
    setLiked(!liked);
    setCount((c) => (liked ? c - 1 : c + 1));

    anim.setValue(0.8);
    Animated.spring(anim, {
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
      console.warn("like toggle err", e);
      // rollback
      setLiked(prev.liked);
      setCount(prev.count);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() =>
        navigation.navigate("ProductDetails", { productId: item.id })
      }
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={[styles.image, compact && styles.imageCompact]}
        />
      ) : (
        <View style={[styles.image, styles.noImage]} />
      )}
      <View style={{ flex: 1, paddingLeft: compact ? 8 : 10 }}>
        <Text
          numberOfLines={1}
          style={[styles.title, compact && { fontSize: 13 }]}
        >
          {item.title}
        </Text>
        <Text style={[styles.price, compact && { fontSize: 12 }]}>
          ₦{Number(item.price).toLocaleString()}
        </Text>
      </View>

      <TouchableOpacity onPress={toggleLike} style={styles.likeWrap}>
        <Animated.View style={{ transform: [{ scale: anim }] }}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={compact ? 16 : 18}
            color={liked ? "#ef4444" : "#6b7280"}
          />
        </Animated.View>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          {formatCount(count)}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  cardCompact: { padding: 6 },
  image: {
    width: "100%",
    height: 110,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f3f4f6",
  },
  imageCompact: { height: 90 },
  noImage: { justifyContent: "center", alignItems: "center" },
  title: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
  price: { color: "#2563eb", fontWeight: "700" },
  likeWrap: { alignItems: "center", position: "absolute", right: 8, top: 8 },
});
