// screens/RoommateSwipeScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import Swiper from "react-native-deck-swiper";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import RoommateCard from "@/components/mods/RoommateCard";
import SwipeControls from "@/components/mods/SwipeControls";
import Ionicons from "react-native-vector-icons/Ionicons";

type ProfileRow = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  age?: number | null;
  department?: string | null;
  location?: string | null;
  bio?: string | null;
  searching_roommate?: boolean | null;
};

export default function RoommateSwipeScreen({ navigation }: any) {
  const { user } = useAuth();
  const swiperRef = useRef<any>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchProfile, setMatchProfile] = useState<ProfileRow | null>(null);
  const [includePassed, setIncludePassed] = useState(false);

  useEffect(() => {
    loadProfiles(false); // default: exclude passed and liked
  }, [user]);

  // loadProfiles(includePassed) — if true we include previously passed profiles
  const loadProfiles = async (includePassedFlag = false) => {
    setLoading(true);
    try {
      if (!user) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      // fetch candidate profiles who are searching
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, age, department, location, bio, searching_roommate"
        )
        .eq("searching_roommate", true)
        .order("created_at", { ascending: false })
        .limit(200);

      if (pErr) {
        console.warn("profiles fetch err:", pErr);
        setProfiles([]);
        setLoading(false);
        return;
      }

      const candidates: ProfileRow[] = (profs || []).filter(
        (p: any) => p.id !== user.id
      );

      // get liked ids (always exclude these)
      const { data: likedRows } = await supabase
        .from("roommate_likes")
        .select("liked_id")
        .eq("liker_id", user.id);
      const likedIds = (likedRows || []).map((r: any) => r.liked_id);

      // get passed ids (exclude them unless includePassedFlag)
      const { data: passedRows } = await supabase
        .from("roommate_passes")
        .select("passed_id")
        .eq("passer_id", user.id);
      const passedIds = (passedRows || []).map((r: any) => r.passed_id);

      let filtered = candidates.filter((c) => !likedIds.includes(c.id));
      if (!includePassedFlag)
        filtered = filtered.filter((c) => !passedIds.includes(c.id));

      setProfiles(filtered);
      setIncludePassed(includePassedFlag);
    } catch (e) {
      console.error("loadProfiles err", e);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // handles swipe events; if right => like, left => pass
  const handleSwipe = async (index: number, isRight: boolean) => {
    const p = profiles[index];
    if (!p || !user) return;

    try {
      if (isRight) {
        // insert like
        const { error: insertErr } = await supabase
          .from("roommate_likes")
          .insert([
            {
              liker_id: user.id,
              liked_id: p.id,
            },
          ]);

        if (insertErr) {
          console.warn("insert like err", insertErr);
        } else {
          // check reciprocal like => match
          const { data: reciprocal } = await supabase
            .from("roommate_likes")
            .select("*")
            .eq("liker_id", p.id)
            .eq("liked_id", user.id)
            .limit(1);

          if (reciprocal && reciprocal.length > 0) {
            // create chat if not exists: look for existing chat pair
            const { data: existing } = await supabase
              .from("chats")
              .select("id")
              .or(`(user_a.eq.${user.id},user_b.eq.${user.id})`)
              .maybeSingle();

            // better: check pair specifically (least/greatest uniqueness wasn't applied in JS)
            // We'll attempt to find an existing chat between the two in either orientation:
            const { data: chatFound } = await supabase
              .from("chats")
              .select("id")
              .or(
                `(user_a.eq.${user.id},user_b.eq.${p.id}),(user_a.eq.${p.id},user_b.eq.${user.id})`
              )
              .limit(1);

            if (!chatFound || chatFound.length === 0) {
              const { data: chatCreated, error: chatErr } = await supabase
                .from("chats")
                .insert([
                  {
                    user_a: user.id,
                    user_b: p.id,
                  },
                ])
                .select("*")
                .maybeSingle();
              if (chatErr) console.warn("chat create err", chatErr);
            }

            // show match modal
            setMatchProfile(p);
          }
        }
      } else {
        // insert a pass record to avoid showing again (unless user asks to refresh)
        const { error: passErr } = await supabase
          .from("roommate_passes")
          .insert([
            {
              passer_id: user.id,
              passed_id: p.id,
            },
          ]);
        if (passErr) console.warn("pass insert err", passErr);
      }
    } catch (e: any) {
      console.error("handleSwipe err", e);
    }
  };

  const onNope = () => swiperRef.current?.swipeLeft();
  const onLike = () => swiperRef.current?.swipeRight();
  const onSuper = () =>
    swiperRef.current?.swipeTop?.() || swiperRef.current?.swipeRight();

  const renderCard = (card: ProfileRow | null) => {
    if (!card) {
      return (
        <View style={styles.emptyCard}>
          <Text style={{ color: "#374151" }}>
            No more students — try later.
          </Text>
        </View>
      );
    }
    return <RoommateCard profile={card} />;
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (navigation as any).goBack()}>
          <Ionicons name="chevron-back" size={28} color="#111" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Find Roommates</Text>

        <TouchableOpacity onPress={() => loadProfiles(true)}>
          <Ionicons name="refresh" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.swiperWrap}>
        <Swiper
          ref={swiperRef}
          cards={profiles}
          cardIndex={0}
          backgroundColor={"transparent"}
          stackSize={3}
          verticalSwipe={false}
          overlayLabels={{
            left: {
              title: "NOPE",
              style: {
                label: { color: "#fff", fontWeight: "800" },
                wrapper: { backgroundColor: "#ef4444" },
              },
            },
            right: {
              title: "LIKE",
              style: {
                label: { color: "#fff", fontWeight: "800" },
                wrapper: { backgroundColor: "#10b981" },
              },
            },
          }}
          animateOverlayLabelsOpacity
          animateCardOpacity
          onSwipedLeft={(i) => handleSwipe(i, false)}
          onSwipedRight={(i) => handleSwipe(i, true)}
          renderCard={renderCard}
          verticalThreshold={80}
          horizontalThreshold={40}
        />
      </View>

      <SwipeControls onNope={onNope} onLike={onLike} onSuper={onSuper} />

      <Modal visible={!!matchProfile} transparent animationType="slide">
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <Text style={{ fontWeight: "800", fontSize: 18 }}>
              It's a match 🎉
            </Text>
            <View style={{ height: 12 }} />
            <RoommateCard profile={matchProfile as ProfileRow} />
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#2563eb" }]}
              onPress={() => {
                setMatchProfile(null);
                (navigation as any).navigate("chats");
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Open chats
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8 }]}
              onPress={() => setMatchProfile(null)}
            >
              <Text style={{ fontWeight: "700" }}>Keep swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  headerRow: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  swiperWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyCard: {
    width: "92%",
    height: 480,
    alignSelf: "center",
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  matchBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  matchCard: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#fff",
    padding: 12,
    alignItems: "center",
    borderRadius: 10,
    width: "80%",
  },
});
