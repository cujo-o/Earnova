import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: string;
  title: string;
  price: number;
  thumbnail_url: string | null;
}

export default function LatestItemsList({ navigation }: any) {
  const [latest, setLatest] = useState<Listing[]>([]);

  useEffect(() => {
    fetchLatest();
  }, []);

  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, price, thumbnail_url")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setLatest(data);
    }
  };

  const renderItem = ({ item }: { item: Listing }) => (
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
      <Text style={styles.price}>₦{item.price}</Text>
    </TouchableOpacity>
  );

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
