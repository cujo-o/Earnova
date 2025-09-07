// screens/ProductDetailsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type RouteParams = { productId: string };

export default function ProductDetailsScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { productId } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any | null>(null);
  const [seller, setSeller] = useState<any | null>(null);

  const isOwner = useMemo(
    () => !!(user && listing && user.id === listing.user_id),
    [user, listing]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // fetch listing
        const { data: l, error: le } = await supabase
          .from("listings")
          .select(
            "id, title, price, description, location, thumbnail_url, user_id, category_id, created_at"
          )
          .eq("id", productId)
          .maybeSingle();

        if (le) throw le;
        if (!l) {
          Alert.alert("Not found", "Listing not found.");
          setListing(null);
          setSeller(null);
          setLoading(false);
          return;
        }

        // fetch seller profile
        let prof = null;
        if (l.user_id) {
          const { data: p, error: pe } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .eq("id", l.user_id)
            .maybeSingle();
          if (pe) console.warn("fetch seller profile error", pe);
          prof = p ?? null;
        }

        if (mounted) {
          setListing(l);
          setSeller(prof);
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
  }, [productId]);

  const startChat = async () => {
    try {
      if (!user) {
        Alert.alert(
          "Sign in required",
          "Please sign in to message the seller."
        );
        return;
      }
      if (!listing) return;
      if (isOwner) return;

      // Always normalize pair so user_a < user_b (string compare) to prevent duplicates
      const sellerId = listing.user_id;
      const [userA, userB] =
        user.id < sellerId ? [user.id, sellerId] : [sellerId, user.id];

      // Try to find an existing chat for this pair (and listing)
      const { data: existing, error: findErr } = await supabase
        .from("chats")
        .select("id")
        .eq("user_a", userA)
        .eq("user_b", userB)
        .limit(1)
        .maybeSingle();

      if (findErr) console.warn("find chat err", findErr);

      let chatId: string | null = existing?.id ?? null;

      if (!chatId) {
        const { data: created, error: createErr } = await supabase
          .from("chats")
          .insert([{ user_a: userA, user_b: userB, listing_id: listing.id }])
          .select("id")
          .maybeSingle();

        if (createErr) throw createErr;
        chatId = created?.id ?? null;
      }

      if (chatId) {
        navigation.navigate("ChatScreen", { chatId });
      } else {
        Alert.alert("Error", "Could not start chat.");
      }
    } catch (e: any) {
      console.error("startChat error", e);
      Alert.alert("Error", e.message ?? "Could not start chat.");
    }
  };

  const deleteListing = async () => {
    if (!listing || !isOwner) return;
    Alert.alert("Delete Listing", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            // try to remove associated storage object (best-effort)
            if (listing.thumbnail_url) {
              try {
                const url = listing.thumbnail_url as string;
                const re = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
                const m = url.match(re);
                if (m && m.length >= 3) {
                  const bucket = m[1];
                  const path = decodeURIComponent(m[2]);
                  const { error: rmErr } = await supabase.storage
                    .from(bucket)
                    .remove([path]);
                  if (rmErr) console.warn("remove image err", rmErr);
                }
              } catch (e) {
                console.warn("delete image fallback err", e);
              }
            }

            const { error: delErr } = await supabase
              .from("listings")
              .delete()
              .eq("id", listing.id);

            if (delErr) {
              console.error("delete listing error", delErr);
              if (
                delErr.message &&
                delErr.message.includes("row-level security")
              ) {
                Alert.alert(
                  "Permission denied",
                  "Cannot delete due to RLS. Ensure policies allow deleting own listings."
                );
              } else {
                Alert.alert("Error", delErr.message || "Could not delete.");
              }
              return;
            }

            Alert.alert("Deleted", "Listing removed.");
            navigation.goBack();
          } catch (e: any) {
            console.error("delete error", e);
            Alert.alert("Error", e.message ?? "Could not delete listing.");
          }
        },
      },
    ]);
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

      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.price}>
        ₦{Number(listing.price).toLocaleString()}
      </Text>
      {!!listing.location && (
        <Text style={styles.location}>{listing.location}</Text>
      )}

      <View style={styles.sellerRow}>
        <Image
          source={{ uri: seller?.avatar_url ?? "https://placehold.co/80x80" }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerName}>
            {seller?.full_name || seller?.username || "Seller"}
          </Text>
          <Text style={styles.sellerHint}>Joined via Earnova</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Description</Text>
      <Text style={styles.description}>
        {listing.description || "No description provided."}
      </Text>

      {!isOwner ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={startChat}>
          <Text style={styles.primaryBtnText}>Message Seller</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.ownerActions}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { marginRight: 8 }]}
            onPress={() =>
              navigation.navigate("EditListing", { listingId: listing.id })
            }
          >
            <Text style={styles.secondaryBtnText}>Edit Listing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteListing}>
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
  noImage: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6, color: "#111827" },
  price: { fontSize: 20, fontWeight: "700", color: "#2563eb", marginBottom: 4 },
  location: { color: "#6b7280", marginBottom: 12 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 8,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  sellerName: { fontWeight: "700", fontSize: 16, color: "#111827" },
  sellerHint: { fontSize: 12, color: "#6b7280" },
  sectionHeader: {
    fontWeight: "700",
    fontSize: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  description: { fontSize: 14, color: "#374151", lineHeight: 20 },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 18,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ownerActions: { flexDirection: "row", marginTop: 18 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#2563eb", fontWeight: "700" },
  deleteBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontWeight: "700" },
});
