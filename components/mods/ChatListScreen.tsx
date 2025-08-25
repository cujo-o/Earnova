// screens/ChatListScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function ChatListScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndChats();
    // optionally subscribe to chat inserts/updates to refresh list in realtime
    // const channel = supabase.channel('chats-list').on('postgres_changes', {...}).subscribe();
    // return () => supabase.removeChannel(channel);
  }, []);

  const fetchUserAndChats = async () => {
    setLoading(true);
    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setCurrentUserId(user.id);

    // Fetch chats where current user is buyer or seller. Join listing + the other profile
    const { data, error } = await supabase
      .from("chats")
      .select(
        `
        id,
        listing_id,
        buyer_id,
        seller_id,
        created_at,
        listings ( id, title, thumbnail_url ),
        buyer:profiles!chats_buyer_id_fkey ( id, username, avatar_url ),
        seller:profiles!chats_seller_id_fkey ( id, username, avatar_url )
      `
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetch chats error", error);
    } else {
      setChats(data || []);
    }
    setLoading(false);
  };

  const renderItem = ({ item }: any) => {
    const other = item.buyer_id === currentUserId ? item.seller : item.buyer;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate("ChatScreen", { chatId: item.id })}
      >
        <View>
          <Text style={styles.title}>
            {item.listings?.title || "Conversation"}
          </Text>
          <Text style={styles.subtitle}>{other?.username || other?.id}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#fff" },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontWeight: "700" },
  subtitle: { color: "#666" },
});
