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
  AppStateStatus,
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // fetch current messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("fetchMessages error:", error.message ?? error);
        return;
      }
      if (data) {
        setMessages(data);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e) {
      console.error("fetchMessages unexpected error:", e);
    }
  };

  // subscribe to realtime inserts for this chat
  const subscribeToMessages = () => {
    // remove existing subscription first
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current).catch((e) => {
        console.warn("removeChannel failed", e);
      });
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

          // append incoming if not present, and remove optimistic placeholder(s)
          setMessages((prev) => {
            // already have this row?
            if (prev.some((m) => m.id === incoming.id)) return prev;

            // remove optimistic placeholder that matches content & sender
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

          // auto-scroll
          setTimeout(
            () => flatRef.current?.scrollToEnd({ animated: true }),
            50
          );
        }
      )
      .subscribe((status) => {
        // status callback helpful for debugging connection state
        // console.log("channel status:", status);
      });

    subscriptionRef.current = channel;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      // get current user id
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id ?? null;
      if (mounted) setUserId(uid);

      // initial load
      await fetchMessages();

      // subscribe
      subscribeToMessages();

      // AppState listener to resync on foreground (helps if subscription dropped)
      const onAppStateChange = (next: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          next === "active"
        ) {
          // app came to foreground — refetch and re-subscribe
          fetchMessages().catch((e) =>
            console.warn("refetch on resume failed", e)
          );
          subscribeToMessages();
        }
        appStateRef.current = next;
      };

      const sub = AppState.addEventListener("change", onAppStateChange);

      if (mounted) setLoading(false);

      // cleanup
      return () => {
        sub.remove();
        if (subscriptionRef.current) {
          supabase
            .removeChannel(subscriptionRef.current)
            .catch((e) => console.warn("removeChan err", e));
          subscriptionRef.current = null;
        }
      };
    };

    // run init and hold cleanup function
    const cleanupPromise = init();

    return () => {
      mounted = false;
      // ensure cleanupPromise resolves and removes subscription
      cleanupPromise.then((maybeCleanup) => {
        /* no-op: init handles removal */
      });
    };
  }, [chatId]); // re-run when chatId changes

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;

    const content = text.trim();
    setText("");

    // optimistic UI: add a temp message so sender sees it straight away
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

    // insert -> subscription will deliver the real row and we remove the optimistic placeholder in handler
    const { error } = await supabase
      .from("messages")
      .insert([{ chat_id: chatId, sender_id: userId, content }]);

    if (error) {
      console.error("sendMessage error:", error);
      // remove optimistic if insert failed
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
    }
    // no explicit fetch here — subscription will handle it
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
        keyExtractor={(item) => item.id.toString()}
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
  bubble: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    maxWidth: "80%",
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f1f1",
  },
  mineText: {
    color: "#fff",
  },
  theirsText: {
    color: "#111",
  },
  time: {
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
