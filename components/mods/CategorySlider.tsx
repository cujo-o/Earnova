import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
};

type Props = {
  onSelect: (categoryId: string | null) => void;
};

export default function CategorySlider({ onSelect }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data, error } = await supabase.from("categories").select("*");
    if (!error && data) setCategories(data);
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={[{ id: "all", name: "All" }, ...categories]}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => onSelect(item.id === "all" ? null : item.id)}
          >
            <Text style={styles.categoryText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#e5e5e5",
    borderRadius: 20,
    marginRight: 8,
  },
  categoryText: {
    color: "#000",
    fontSize: 14,
  },
});
