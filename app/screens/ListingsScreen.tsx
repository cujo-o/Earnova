import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: string;
  title: string;
  price: number;
  location: string | null;
  thumbnail_url: string | null;
  categories?: { name: string } | null;
}

export default function ListingScreen({ navigation }: any) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, price, location, thumbnail_url, categories(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setListings([]); // fallback to empty list
    } else if (data) {
      setListings(data as unknown as Listing[]); // cast more safely
    }
    setLoading(false);
  };

  const renderItem = ({ item }: { item: Listing }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("ProductDetails", { productId: item.id })
      }
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.noImage]}>
          <Text>No Image</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.price}> ₦{Number(item.price).toLocaleString()}</Text>
        <Text style={styles.meta}>
          {item.categories?.name ?? "Uncategorized"} •{" "}
          {item.location || "Unknown"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
      />
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
  },
  thumbnail: { width: 100, height: 100 },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
  },
  cardContent: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  price: {
    color: "#2563eb",
    fontWeight: "600",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: "#6b7280",
  },
});
