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
  AppState,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function ChatScreen({ route }: any) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const flatRef = useRef<FlatList | null>(null);
  const subscriptionRef = useRef<any | null>(null);

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

  const subscribeToMessages = () => {
    // remove previous
    if (subscriptionRef.current) {
      supabase
        .removeChannel(subscriptionRef.current)
        .catch((e) => console.warn("removeChannel err", e));
      subscriptionRef.current = null;
    }

    const channelName = `chat-${chatId}`;
    const channel = supabase
      .channel(channelName)
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
            // remove optimistic placeholder(s) matching this content & sender
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
      try {
        const { data: userResp } = await supabase.auth.getUser();
        const uid = userResp?.user?.id ?? null;
        if (mounted) setUserId(uid);

        await fetchMessages();
        subscribeToMessages();

        // handle app state re-attach
        const onAppStateChange = (next: any) => {
          if (next === "active") {
            // refresh & resubscribe
            fetchMessages().catch((e) => console.warn("refetch fail", e));
            subscribeToMessages();
          }
        };
        const sub = AppState.addEventListener("change", onAppStateChange);

        if (mounted) setLoading(false);

        return () => {
          sub.remove();
        };
      } catch (e) {
        console.error("chat init err", e);
      }
    };

    const maybeCleanupPromise = init();

    return () => {
      mounted = false;
      // remove subscription
      if (subscriptionRef.current) {
        supabase
          .removeChannel(subscriptionRef.current)
          .catch((e) => console.warn("removeChannel err", e));
        subscriptionRef.current = null;
      }
    };
  }, [chatId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");

    // optimistic UI
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
      console.error("sendMessage error", error);
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
    }
    // subscription will deliver real row and remove optimistic placeholder
  };

  const renderItem = ({ item }: any) => {
    const mine = item.sender_id === userId;
    return (
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={mine ? styles.mineText : styles.theirsText}>
          {item.content}
        </Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() =>
          flatRef.current?.scrollToEnd({ animated: true })
        }
      />

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
    marginBottom: 25,
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
