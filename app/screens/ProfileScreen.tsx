// screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/lib/auth";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [savedProfiles, setSavedProfiles] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);

  useEffect(() => {
    loadAll();
    // re-run when navigation returns to screen?
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await loadProfile();
      await loadSavedProfiles();
      await loadMyListings();
    } catch (e) {
      console.warn("loadAll err", e);
    } finally {
      setLoading(false);
    }
  };

  async function loadProfile() {
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const u = userResp?.user;
      if (!u) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url")
        .eq("id", u.id)
        .maybeSingle();

      if (error) {
        console.warn("profiles select error:", error);
      } else {
        setProfile(data);
      }
    } catch (e) {
      console.error("loadProfile err", e);
    }
  }

  async function loadSavedProfiles() {
    try {
      if (!user) return;
      const { data } = await supabase
        .from("saved_profiles")
        .select("saved_id, created_at, profiles ( id, username, full_name, avatar_url, bio )")
        .eq("saver_id", user.id)
        .order("created_at", { ascending: false });

      // supabase returns nested `profiles` object
      const mapped = (data || []).map((row: any) => ({
        saved_id: row.saved_id,
        meta: row.profiles,
      }));
      setSavedProfiles(mapped);
    } catch (e) {
      console.error("loadSavedProfiles err", e);
    }
  }

  async function loadMyListings() {
    try {
      if (!user) return;
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, thumbnail_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setMyListings(data || []);
    } catch (e) {
      console.error("loadMyListings err", e);
    }
  }

  const startChatWith = async (otherId: string) => {
    if (!user) {
      Alert.alert("Sign in required");
      return;
    }

    try {
      // find existing chat in either orientation
      const { data: chatFound } = await supabase
        .from("chats")
        .select("id")
        .or(`(user_a.eq.${user.id},user_b.eq.${otherId}),(user_a.eq.${otherId},user_b.eq.${user.id})`)
        .limit(1);

      let chatId = chatFound && chatFound.length > 0 ? chatFound[0].id : null;

      if (!chatId) {
        const { data: chatCreated, error: chatErr } = await supabase
          .from("chats")
          .insert([{ user_a: user.id, user_b: otherId }])
          .select("id")
          .maybeSingle();
        if (chatErr) {
          console.warn("chat create err", chatErr);
        } else {
          chatId = chatCreated?.id;
        }
      }

      if (chatId) {
        (navigation as any).navigate("ChatScreen", { chatId });
      } else {
        Alert.alert("Error", "Could not open chat");
      }
    } catch (e: any) {
      console.error("startChatWith err", e);
      Alert.alert("Error", e.message || "Could not start chat");
    }
  };

  const removeSaved = async (savedId: string) => {
    try {
      const { error } = await supabase
        .from("saved_profiles")
        .delete()
        .eq("saver_id", user?.id)
        .eq("saved_id", savedId);
      if (error) throw error;
      // refresh
      await loadSavedProfiles();
    } catch (e: any) {
      console.error("removeSaved err", e);
      Alert.alert("Error", "Could not remove saved profile");
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => (navigation as any).navigate("EditProfile")}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={{ color: "#111" }}>Add</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.name}>{profile?.full_name || profile?.username}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logout} onPress={async () => { await supabase.auth.signOut(); }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>Saved Students</Text>
        {savedProfiles.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>You have no saved profiles.</Text>
        ) : (
          <FlatList
            data={savedProfiles}
            keyExtractor={(i) => i.saved_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const p = item.meta;
              return (
                <View style={styles.savedCard}>
                  <Image source={{ uri: p.avatar_url ?? "https://placehold.co/80x80" }} style={styles.savedAvatar} />
                  <Text style={{ fontWeight: "700" }}>{p.full_name || p.username}</Text>
                  <View style={{ flexDirection: "row", marginTop: 6 }}>
                    <TouchableOpacity onPress={() => startChatWith(p.id)} style={styles.smallBtn}>
                      <Ionicons name="chatbubble-outline" size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeSaved(p.id)} style={[styles.smallBtn, { marginLeft: 8 }]}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            style={{ marginTop: 8 }}
          />
        )}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.sectionTitle}>My Listings</Text>
        {myListings.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>You haven't added listings yet.</Text>
        ) : (
          <FlatList
            data={myListings}
            keyExtractor={(i) => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listingCard} onPress={() => (navigation as any).navigate("ProductDetails", { productId: item.id })}>
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.listingImage} />
                ) : (
                  <View style={[styles.listingImage, { justifyContent: "center", alignItems: "center" }]}><Text>No image</Text></View>
                )}
                <Text style={{ fontWeight: "700", marginTop: 6 }}>{item.title}</Text>
                <Text style={{ color: "#2563eb" }}>₦{Number(item.price).toLocaleString()}</Text>
              </TouchableOpacity>
            )}
            style={{ marginTop: 8, paddingBottom: 24 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "800" },
  username: { color: "#6b7280" },
  logout: { backgroundColor: "#ef4444", padding: 10, borderRadius: 8 },
  sectionTitle: { fontWeight: "800", fontSize: 16, marginBottom: 8 },
  savedCard: { width: 120, padding: 10, marginRight: 12, backgroundColor: "#f8fafc", borderRadius: 10, alignItems: "center" },
  savedAvatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 6 },
  smallBtn: { backgroundColor: "#fff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  listingCard: { width: 160, marginRight: 12 },
  listingImage: { width: 160, height: 100, borderRadius: 8, backgroundColor: "#f3f4f6" },
});
