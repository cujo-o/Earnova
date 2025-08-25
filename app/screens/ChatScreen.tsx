// screens/ChatScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function ChatScreen({ route }: any) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      setUserId(userResp?.user?.id ?? null);
      await loadMessages();
    })();

    // subscribe to new messages for this chat
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
          setMessages((prev) => [...prev, payload.new]);
          // auto-scroll later
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      mounted = false;
    };
  }, [chatId]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id,content,sender_id,created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) return;

    const { error } = await supabase
      .from("messages")
      .insert([{ chat_id: chatId, sender_id: uid, content: text.trim() }]);

    if (error) {
      console.error("send message error", error);
    } else {
      setText("");
      // realtime will append the saved message
      loadMessages();
    }
  };

  const renderItem = ({ item }: any) => {
    const mine = item.sender_id === userId;
    return (
      <View style={[styles.msgRow, mine ? styles.msgMine : styles.msgOther]}>
        <Text style={mine ? styles.msgTextMine : styles.msgTextOther}>
          {item.content}
        </Text>
        <Text style={styles.msgTime}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
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
  container: { flex: 1, backgroundColor: "#fff" },
  msgRow: { marginBottom: 10, padding: 10, borderRadius: 10, maxWidth: "80%" },
  msgMine: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  msgOther: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f1f1",
  },
  msgTextMine: { color: "#fff" },
  msgTextOther: {
    color: "#111",
  },
  msgTime: {
    fontSize: 10,
    color: "#666",
    marginTop: 6,
    textAlign: "right",
  },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    marginBottom: 15,
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
