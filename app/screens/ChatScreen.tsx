// screens/ChatScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

export default function ChatScreen({ route }: any) {
  const { chatId } = route.params;
  const navigation = useNavigation<any>();

  const [chat, setChat] = useState<any | null>(null);
  const [other, setOther] = useState<any | null>(null);
  const [listing, setListing] = useState<any | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const flatRef = useRef<FlatList | null>(null);
  const subscriptionRef = useRef<any | null>(null);

  // fetch chat row + partner + listing
  const loadChatMeta = async () => {
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id ?? null;
      setUserId(uid);

      const { data: chatRow, error } = await supabase
        .from("chats")
        .select(
          `
          id,
          listing_id,
          user_a,
          user_b,
          created_at,
          profile_a:profiles!chats_user_a_fkey ( id, username, full_name, avatar_url ),
          profile_b:profiles!chats_user_b_fkey ( id, username, full_name, avatar_url )
        `
        )
        .eq("id", chatId)
        .maybeSingle();

      if (error) throw error;
      if (!chatRow) {
        Alert.alert("Chat not found");
        navigation.goBack();
        return;
      }

      setChat(chatRow);

      // pick other participant
      const isA = chatRow.user_a === uid;
      const otherRaw = isA ? chatRow.profile_b : chatRow.profile_a;
      const otherObj = Array.isArray(otherRaw) ? otherRaw[0] ?? null : otherRaw;
      setOther(otherObj ?? null);

      // fetch listing snippet if listing_id exists
      if (chatRow.listing_id) {
        const { data: l, error: lErr } = await supabase
          .from("listings")
          .select("id,title,thumbnail_url,price")
          .eq("id", chatRow.listing_id)
          .maybeSingle();
        if (l) setListing(l);
        if (lErr) console.warn("listing fetch err", lErr);
      }
    } catch (e: any) {
      console.error("loadChatMeta err", e);
      Alert.alert("Error", e.message || "Could not load chat.");
    }
  };

  // fetch messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id, content, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("fetchMessages error", error);
        return;
      }
      if (data) {
        setMessages(data);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e) {
      console.error("fetchMessages unexpected", e);
    }
  };

  // subscribe to messages for this chat
  const subscribe = () => {
    // remove existing
    if (subscriptionRef.current) {
      supabase
        .removeChannel(subscriptionRef.current)
        .catch((e) => console.warn("removeChannel err", e));
      subscriptionRef.current = null;
    }

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const incoming = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // remove optimistic placeholder matching content & sender
            const withoutTemp = prev.filter(
              (m) =>
                !(
                  typeof m.id === "string" &&
                  m.id.startsWith("tmp-") &&
                  m.content === incoming.content &&
                  m.sender_id === incoming.sender_id
                )
            );
            return [...withoutTemp, incoming];
          });
          setTimeout(
            () => flatRef.current?.scrollToEnd({ animated: true }),
            50
          );
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      await loadChatMeta();
      await fetchMessages();
      subscribe();
      if (mounted) setLoading(false);
    };

    init();

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        supabase
          .removeChannel(subscriptionRef.current)
          .catch((e) => console.warn("removeChannel err", e));
        subscriptionRef.current = null;
      }
    };
  }, [chatId]);

  // send message (optimistic)
  const sendMessage = async () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText("");

    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      chat_id: chatId,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    const { error } = await supabase
      .from("messages")
      .insert([{ chat_id: chatId, sender_id: userId, content }]);
    if (error) {
      console.error("send msg err", error);
      // remove optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      Alert.alert("Error", error.message || "Could not send message");
    }
    // real message will arrive through subscription
  };

  // long-press message -> delete (only if current user is sender)
  const confirmDeleteMessage = (msg: any) => {
    if (!userId || msg.sender_id !== userId) return;
    Alert.alert("Delete message", "Delete this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("messages")
              .delete()
              .eq("id", msg.id);
            if (error) throw error;
            // remove locally
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          } catch (e: any) {
            console.error("delete message err", e);
            Alert.alert("Error", e.message || "Could not delete message");
          }
        },
      },
    ]);
  };

  // delete entire chat
  const confirmDeleteChat = () => {
    Alert.alert(
      "Delete chat",
      "Delete this chat and all messages? This is permanent.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("chats")
                .delete()
                .eq("id", chatId);
              if (error) throw error;
              // locally go back
              Alert.alert("Deleted", "Chat removed.");
              navigation.goBack();
            } catch (e: any) {
              console.error("delete chat err", e);
              Alert.alert(
                "Error",
                e.message || "Could not delete chat (RLS/policy?)"
              );
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: any) => {
    const mine = item.sender_id === userId;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => confirmDeleteMessage(item)}
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
      >
        <Text style={mine ? styles.mineText : styles.theirsText}>
          {item.content}
        </Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 18 }}>◀</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Image
            source={{ uri: other?.avatar_url ?? "https://placehold.co/48x48" }}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerName}>
              {other?.full_name || other?.username || "User"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => {
              // quick go to listing if exists
              if (listing)
                navigation.navigate("ProductDetails", {
                  productId: listing.id,
                });
            }}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: "#2563eb" }}>Listing</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={confirmDeleteChat}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        onContentSizeChange={() =>
          flatRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 72,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  headerAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 10 },
  headerName: { fontWeight: "800" },
  bubble: { marginBottom: 8, padding: 10, borderRadius: 10, maxWidth: "80%" },
  mine: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  theirs: { alignSelf: "flex-start", backgroundColor: "#f1f1f1" },
  mineText: { color: "#fff" },
  theirsText: { color: "#111" },
  time: { fontSize: 10, color: "#666", marginTop: 6, textAlign: "right" },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 44,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: "center",
  },
});
