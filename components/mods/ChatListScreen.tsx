// screens/ChatListScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";

type ChatRow = {
  id: string;
  listing_id?: string | null;
  user_a: string;
  user_b: string;
  created_at: string;
  other?: { id: string; username?: string | null; avatar_url?: string | null };
  lastMessage?: { id: string; content: string; sender_id: string; created_at: string };
};

export default function ChatListScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const chatIdsRef = useRef<Set<string>>(new Set());
  const subRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        const { data: userResp } = await supabase.auth.getUser();
        const user = userResp?.user;
        if (!user) {
          setLoading(false);
          return;
        }
        if (!mounted) return;
        setCurrentUserId(user.id);

        // 1) fetch chats where current user participates
        const { data: chatData, error: chatErr } = await supabase
          .from("chats")
          .select(
            `
              id,
              listing_id,
              user_a,
              user_b,
              created_at,
              profile_a:profiles!chats_user_a_fkey ( id, username, avatar_url ),
              profile_b:profiles!chats_user_b_fkey ( id, username, avatar_url )
            `
          )
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (chatErr) throw chatErr;

        const normalized: ChatRow[] = (chatData || []).map((c: any) => {
          const otherRaw = c.user_a === user.id ? c.profile_b : c.profile_a;
          const other = Array.isArray(otherRaw) ? (otherRaw[0] ?? null) : otherRaw;
          return {
            id: c.id,
            listing_id: c.listing_id,
            user_a: c.user_a,
            user_b: c.user_b,
            created_at: c.created_at,
            other: other ? { id: other.id, username: other.username, avatar_url: other.avatar_url } : undefined,
          };
        });

        if (!mounted) return;
        setChats(normalized);
        chatIdsRef.current = new Set(normalized.map((r) => r.id));

        // 2) fetch latest message per chat (bulk)
        if (normalized.length) {
          const chatIds = normalized.map((c) => c.id);
          const { data: msgs, error: msgErr } = await supabase
            .from("messages")
            .select("id, chat_id, content, sender_id, created_at")
            .in("chat_id", chatIds)
            .order("created_at", { ascending: false });
          if (msgErr) console.warn("latest message fetch err", msgErr);
          else if (msgs) {
            // msgs ordered desc; first per chat is latest
            const latestMap = new Map<string, any>();
            for (const m of msgs) {
              if (!latestMap.has(m.chat_id)) latestMap.set(m.chat_id, m);
            }
            setChats((prev) => prev.map((r) => ({ ...r, lastMessage: latestMap.get(r.id) ?? undefined })));
          }
        }

        // 3) subscribe to new messages globally - RLS will restrict what this user sees
        const channel = supabase
          .channel("public:messages")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
            const newMsg = payload.new as any;

            // If the chat is already in our list, update its lastMessage and move it to top
            if (chatIdsRef.current.has(newMsg.chat_id)) {
              setChats((prev) => {
                const updated = prev.map((c) => (c.id === newMsg.chat_id ? { ...c, lastMessage: newMsg } : c));
                const idx = updated.findIndex((c) => c.id === newMsg.chat_id);
                if (idx > 0) {
                  const [moved] = updated.splice(idx, 1);
                  return [moved, ...updated];
                }
                return updated;
              });
              return;
            }

            // Otherwise maybe a new chat was created for this user -> fetch that chat row and add it
            try {
              const { data: chatRow, error: fetchChatErr } = await supabase
                .from("chats")
                .select(
                  `
                  id, listing_id, user_a, user_b, created_at,
                  profile_a:profiles!chats_user_a_fkey ( id, username, avatar_url ),
                  profile_b:profiles!chats_user_b_fkey ( id, username, avatar_url )
                `
                )
                .eq("id", newMsg.chat_id)
                .maybeSingle();

              if (fetchChatErr) {
                console.warn("fetch chat row err", fetchChatErr);
                return;
              }
              if (!chatRow) return;

              // pick the "other" participant for display
              const otherRaw = (chatRow.user_a === currentUserId) ? chatRow.profile_b : chatRow.profile_a;
              const other = Array.isArray(otherRaw) ? (otherRaw[0] ?? null) : otherRaw;

              const newChat: ChatRow = {
                id: chatRow.id,
                listing_id: chatRow.listing_id,
                user_a: chatRow.user_a,
                user_b: chatRow.user_b,
                created_at: chatRow.created_at,
                other: other ? { id: other.id, username: other.username, avatar_url: other.avatar_url } : undefined,
                lastMessage: newMsg,
              };

              setChats((prev) => [newChat, ...prev]);
              chatIdsRef.current.add(newChat.id);
            } catch (e) {
              console.warn("Error adding chat from message payload:", e);
            }
          })
          .subscribe();

        subRef.current = channel;
      } catch (e: any) {
        console.error("init chatlist err", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (subRef.current) {
        supabase.removeChannel(subRef.current).catch((e) => console.warn("removeChannel err", e));
        subRef.current = null;
      }
    };
  }, []);

  const renderItem = ({ item }: { item: ChatRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("ChatScreen", { chatId: item.id })}>
      <View style={styles.left}>
        <View style={styles.avatarPlaceholder} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title}>{item.other?.username ?? "Unknown"}</Text>
        <Text numberOfLines={1} style={styles.snippet}>
          {item.lastMessage ? item.lastMessage.content : "No messages yet"}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.time}>
          {item.lastMessage ? new Date(item.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList data={chats} keyExtractor={(i) => i.id} renderItem={renderItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee", alignItems: "center" },
  left: { width: 48, alignItems: "center", justifyContent: "center" },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6" },
  mid: { flex: 1, paddingLeft: 12 },
  right: { width: 80, alignItems: "flex-end" },
  title: { fontWeight: "700" },
  snippet: { color: "#6b7280", marginTop: 4 },
  time: { fontSize: 12, color: "#9ca3af" },
});
