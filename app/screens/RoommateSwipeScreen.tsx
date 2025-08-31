// screens/RoommateSwipeScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";

const SCREEN = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN.width * 0.25;

export default function RoommateSwipeScreen() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const pos = useRef(new Animated.ValueXY()).current;
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id ?? null;
      setUserId(uid);

      // get other profiles who are searching_roommate true and not the current user
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, age, department, location, bio"
        )
        .eq("searching_roommate", true)
        .neq("id", uid)
        .limit(50);

      if (error) console.error("fetch swipe profiles", error);
      else setProfiles(data || []);
      setLoading(false);
    })();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        pos.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: async (_e, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // like
          Animated.timing(pos, {
            toValue: { x: SCREEN.width + 100, y: gesture.dy },
            useNativeDriver: true,
            duration: 200,
          }).start(() => {
            handleSwipe(true);
            pos.setValue({ x: 0, y: 0 });
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // pass
          Animated.timing(pos, {
            toValue: { x: -SCREEN.width - 100, y: gesture.dy },
            useNativeDriver: true,
            duration: 200,
          }).start(() => {
            handleSwipe(false);
            pos.setValue({ x: 0, y: 0 });
          });
        } else {
          // reset
          Animated.spring(pos, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleSwipe = async (liked: boolean) => {
    const profile = profiles[currentIndex];
    if (!profile || !userId) return;

    // insert or update like
    const { error } = await supabase
      .from("likes")
      .upsert(
        { swiper_id: userId, swiped_id: profile.id, liked },
        { onConflict: "(swiper_id, swiped_id)" }
      );
    if (error) console.warn("like insert err", error);

    setCurrentIndex((i) => i + 1);
  };

  const renderCard = (item: any, i: number) => {
    if (i < currentIndex) return null;
    if (i === currentIndex) {
      const rotate = pos.x.interpolate({
        inputRange: [-SCREEN.width / 2, 0, SCREEN.width / 2],
        outputRange: ["-10deg", "0deg", "10deg"],
        extrapolate: "clamp",
      });
      return (
        <Animated.View
          key={item.id}
          style={[
            styles.card,
            { transform: [...pos.getTranslateTransform(), { rotate }] },
          ]}
          {...panResponder.panHandlers}
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: "#f3f4f6" }]} />
          )}
          <Text style={styles.name}>{item.full_name ?? item.username}</Text>
          <Text style={styles.meta}>
            {item.age ? `${item.age} • ` : ""}
            {item.department ?? ""}
          </Text>
          <Text style={styles.bio}>{item.bio}</Text>
        </Animated.View>
      );
    }
    // next cards slightly scaled
    return (
      <Animated.View
        key={item.id}
        style={[
          styles.card,
          {
            top: 10 * (i - currentIndex),
            transform: [{ scale: 1 - (i - currentIndex) * 0.03 }],
          },
        ]}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: "#f3f4f6" }]} />
        )}
        <Text style={styles.name}>{item.full_name ?? item.username}</Text>
        <Text style={styles.meta}>
          {item.age ? `${item.age} • ` : ""}
          {item.department ?? ""}
        </Text>
        <Text style={styles.bio}>{item.bio}</Text>
      </Animated.View>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (currentIndex >= profiles.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          No more profiles
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {profiles
        .slice(currentIndex, currentIndex + 3)
        .map((p, i) => renderCard(p, currentIndex + i))}

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => handleSwipe(false)}
          style={[styles.controlBtn, { backgroundColor: "#ef4444" }]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSwipe(true)}
          style={[styles.controlBtn, { backgroundColor: "#10b981" }]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Like</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  card: {
    position: "absolute",
    width: SCREEN.width - 40,
    height: SCREEN.height * 0.6,
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  avatar: { width: "100%", height: "65%", borderRadius: 8, marginBottom: 8 },
  name: { fontSize: 20, fontWeight: "800" },
  meta: { color: "#6b7280", marginTop: 4 },
  bio: { marginTop: 8, color: "#374151" },
  controls: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    width: "80%",
    justifyContent: "space-between",
  },
  controlBtn: {
    width: 120,
    padding: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});
