// screens/ChatScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export default function ChatScreen({ route }: any) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getUser();
    fetchMessages();
    const subscription = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload.new.chat_id === chatId) {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !userId) return;
    await supabase.from("messages").insert([
      { chat_id: chatId, content: newMsg.trim(), sender_id: userId },
    ]);
    setNewMsg("");
  };

  const renderItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.msgBubble,
        item.sender_id === userId
          ? styles.myMsg
          : styles.otherMsg,
      ]}
    >
      <Text style={styles.msgText}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={newMsg}
          onChangeText={setNewMsg}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  msgBubble: {
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
    maxWidth: "70%",
  },
  myMsg: { backgroundColor: "#2563eb", alignSelf: "flex-end" },
  otherMsg: { backgroundColor: "#e5e7eb", alignSelf: "flex-start" },
  msgText: { color: "#fff" },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "600" },
});
