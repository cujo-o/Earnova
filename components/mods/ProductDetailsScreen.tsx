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
import {
  RouteProp,
  useNavigation,
  useRoute,
  NavigationProp,
} from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type RootStackParamList = {
  ProductDetails: { productId: string };
  ChatScreen: { chatId: string };
  EditListing: { listingId: string };
};

type ProductDetailsRoute = RouteProp<RootStackParamList, "ProductDetails">;

interface Listing {
  id: string;
  title: string;
  price: number;
  description: string | null;
  location: string | null;
  thumbnail_url: string | null;
  user_id: string;
  category_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export default function ProductDetailsScreen() {
  const { user } = useAuth();
  const route = useRoute<ProductDetailsRoute>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { productId } = route.params;

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const isOwner = useMemo(
    () => !!(user && listing && user.id === listing.user_id),
    [user, listing]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      // 1) Get listing
      const { data: l, error: le } = await supabase
        .from("listings")
        .select(
          "id,title,price,description,location,thumbnail_url,user_id,category_id,created_at"
        )
        .eq("id", productId)
        .single();

      if (le) {
        console.error(le);
        if (mounted) {
          Alert.alert("Error", "Could not load product.");
          setLoading(false);
        }
        return;
      }

      // 2) Get seller profile
      let prof: Profile | null = null;
      if (l?.user_id) {
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("id,username,full_name,avatar_url")
          .eq("id", l.user_id)
          .single();
        if (pe) console.warn("Profile fetch error:", pe.message);
        prof = p ?? null;
      }

      if (mounted) {
        setListing(l);
        setSeller(prof);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const startChat = async () => {
    try {
      if (!user || !listing) {
        Alert.alert("Login required", "Please sign in to message the seller.");
        return;
      }
      if (isOwner) return;

      // Reuse chat if it already exists
      const { data: existing, error: findErr } = await supabase
        .from("chats")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("buyer_id", user.id)
        .eq("seller_id", listing.user_id)
        .maybeSingle();

      if (findErr) {
        console.warn("Find chat error:", findErr.message);
      }

      let chatId: string | null = existing?.id ?? null;

      if (!chatId) {
        const { data: created, error: createErr } = await supabase
          .from("chats")
          .insert([
            {
              listing_id: listing.id,
              buyer_id: user.id,
              seller_id: listing.user_id,
            },
          ])
          .select("id")
          .single();

        if (createErr) {
          throw createErr;
        }
        chatId = created.id;
      }

      // Navigate to ChatScreen
      // Ensure your stack has: <Stack.Screen name="ChatScreen" component={ChatScreen} />
      if (chatId) {
        navigation.navigate("ChatScreen", { chatId });
      } else {
        Alert.alert("Error", "Could not start chat.");
      }
    } catch (e: any) {
      console.error("Start chat error:", e);
      Alert.alert("Error", e.message ?? "Could not start chat.");
    }
  };

  const deleteListing = async () => {
    if (!listing || !isOwner) return;
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Try removing image file if we can derive its storage path
              if (listing.thumbnail_url) {
                // expected public URL form:
                // https://<project>.supabase.co/storage/v1/object/public/listing-images/<path>
                const prefix = "/object/public/listing-images/";
                const idx = listing.thumbnail_url.indexOf(prefix);
                if (idx !== -1) {
                  const path = listing.thumbnail_url.substring(
                    idx + prefix.length
                  );
                  const { error: rmErr } = await supabase.storage
                    .from("listing-images")
                    .remove([path]);
                  if (rmErr) console.warn("Image remove error:", rmErr.message);
                }
              }

              const { error: delErr } = await supabase
                .from("listings")
                .delete()
                .eq("id", listing.id);

              if (delErr) throw delErr;

              Alert.alert("Deleted", "Your listing was removed.");
              navigation.goBack();
            } catch (e: any) {
              console.error("Delete error:", e);
              Alert.alert("Error", e.message ?? "Could not delete listing.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
          source={{
            uri:
              seller?.avatar_url ??
              "https://placehold.co/80x80/png?text=Avatar",
          }}
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
              // Make sure you have an EditListing screen registered if you use this
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
