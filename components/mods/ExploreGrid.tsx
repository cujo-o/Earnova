import React, { useEffect, useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import ListingCardGrid from "./ListingCardGrid";

export default function ExploreGrid({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("listings")
          .select("id, title, price, thumbnail_url, created_at")
          .limit(50);
        if (!data || data.length === 0) {
          setItems([]);
          return;
        }
        // shuffle
        const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 6);
        setItems(shuffled);
      } catch (e) {
        console.warn("explore fetch err", e);
      }
    })();
  }, []);

  return (
    <View style={styles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        renderItem={({ item }) => (
          <ListingCardGrid item={item} navigation={navigation} compact />
        )}
        scrollEnabled={false}
        columnWrapperStyle={{ justifyContent: "space-between" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { paddingHorizontal: 12 } });
