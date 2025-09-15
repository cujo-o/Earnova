// screens/ProductDetailsScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Ionicons from "react-native-vector-icons/Ionicons";

type RouteParams = { productId: string };

export default function ProductDetailsScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { productId } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any | null>(null);
  const [seller, setSeller] = useState<any | null>(null);

  // like state
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const anim = useRef(new Animated.Value(1)).current; // for pop

  const isOwner = useMemo(
    () => !!(user && listing && user.id === listing.user_id),
    [user, listing]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // listing
        const { data: l } = await supabase
          .from("listings")
          .select(
            "id, title, price, description, location, thumbnail_url, user_id, category_id, created_at"
          )
          .eq("id", productId)
          .maybeSingle();

        if (!l) {
          if (mounted) {
            Alert.alert("Not found", "Listing not found.");
            setListing(null);
            setSeller(null);
            setLoading(false);
          }
          return;
        }

        // seller
        let prof = null;
        if (l.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .eq("id", l.user_id)
            .maybeSingle();
          prof = p ?? null;
        }

        if (mounted) {
          setListing(l);
          setSeller(prof);
        }

        // likes count & whether current user liked
        const [{ count }, { data: userLike }] = await Promise.all([
          supabase
            .from("listing_likes")
            .select("id", { count: "exact", head: false })
            .eq("listing_id", productId),
          user
            ? supabase
                .from("listing_likes")
                .select("id")
                .eq("listing_id", productId)
                .eq("liker_id", user.id)
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (mounted) {
          setLikesCount(typeof count === "number" ? count : 0);
          setLiked(!!(userLike && (userLike as any).id));
        }
      } catch (e: any) {
        console.error("load listing error", e);
        Alert.alert("Error", e.message ?? "Could not load listing.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [productId, user]);

  const animatePop = () => {
    anim.setValue(0.8);
    Animated.spring(anim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const toggleLike = async () => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to like listings.");
      return;
    }
    if (!listing) return;

    const LID = listing.id;

    // optimistic
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    animatePop();

    try {
      if (!prevLiked) {
        // insert
        const { error } = await supabase.from("listing_likes").insert([
          { listing_id: LID, liker_id: user.id },
        ]);
        if (error) throw error;
      } else {
        // delete
        const { error } = await supabase
          .from("listing_likes")
          .delete()
          .eq("listing_id", LID)
          .eq("liker_id", user.id);
        if (error) throw error;
      }
      // success (nothing else to do)
    } catch (err: any) {
      console.error("toggleLike err", err);
      // revert optimistic state
      setLiked(prevLiked);
      setLikesCount(prevCount);
      Alert.alert("Error", "Could not update like. Try again.");
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text>Listing not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {listing.thumbnail_url ? (
        <Image source={{ uri: listing.thumbnail_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.noImage]}>
          <Text>No Image</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>₦{Number(listing.price).toLocaleString()}</Text>
        </View>

        {/* Like + count (large, noticeable but not huge) */}
        <View style={{ alignItems: "center", marginLeft: 12 }}>
          <TouchableOpacity onPress={toggleLike} activeOpacity={0.8}>
            <Animated.View style={{ transform: [{ scale: anim }] }}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={34}
                color={liked ? "#ef4444" : "#374151"}
              />
            </Animated.View>
          </TouchableOpacity>
          <Text style={{ marginTop: 4, color: "#6b7280" }}>{likesCount}</Text>
        </View>
      </View>

      {!!listing.location && <Text style={styles.location}>{listing.location}</Text>}

      <View style={styles.sellerRow}>
        <Image source={{ uri: seller?.avatar_url ?? "https://placehold.co/80x80" }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerName}>{seller?.full_name || seller?.username || "Seller"}</Text>
          <Text style={styles.sellerHint}>Joined via Earnova</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Description</Text>
      <Text style={styles.description}>{listing.description || "No description provided."}</Text>

      {!isOwner ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("ChatScreen", { productId })}>
          <Text style={styles.primaryBtnText}>Message Seller</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.ownerActions}>
          <TouchableOpacity style={[styles.secondaryBtn, { marginRight: 8 }]} onPress={() => navigation.navigate("EditListing", { listingId: listing.id })}>
            <Text style={styles.secondaryBtnText}>Edit Listing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => Alert.alert("Delete flow handled elsewhere")}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: 240, borderRadius: 12, marginBottom: 12 },
  noImage: { backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6, color: "#111827" },
  price: { fontSize: 20, fontWeight: "700", color: "#2563eb", marginBottom: 4 },
  location: { color: "#6b7280", marginBottom: 12 },
  sellerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  sellerName: { fontWeight: "700", fontSize: 16, color: "#111827" },
  sellerHint: { fontSize: 12, color: "#6b7280" },
  sectionHeader: { fontWeight: "700", fontSize: 16, marginTop: 16, marginBottom: 6 },
  description: { fontSize: 14, color: "#374151", lineHeight: 20 },
  primaryBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 18 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ownerActions: { flexDirection: "row", marginTop: 18 },
  secondaryBtn: { borderWidth: 1, borderColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  secondaryBtnText: { color: "#2563eb", fontWeight: "700" },
  deleteBtn: { backgroundColor: "#ef4444", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontWeight: "700" },
});
