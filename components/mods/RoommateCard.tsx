// components/RoommateCard.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

type Profile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  age?: number | null;
  department?: string | null;
  location?: string | null;
  bio?: string | null;
};

export default function RoommateCard({ profile }: { profile: Profile }) {
  return (
    <View style={s.card}>
      <Image
        source={{
          uri:
            profile.avatar_url ??
            "https://placehold.co/800x600/png?text=No+Photo",
        }}
        style={s.image}
      />
      <View style={s.info}>
        <Text style={s.name}>
          {profile.full_name ?? profile.username ?? "Student"}
          {profile.age ? `, ${profile.age}` : ""}
        </Text>
        <Text style={s.meta}>
          {profile.department ?? "Department"} •{" "}
          {profile.location ?? "Location"}
        </Text>
        {profile.bio ? (
          <Text numberOfLines={4} style={s.bio}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: "92%",
    height: 520,
    alignSelf: "center",
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderColor: "#eee",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 6,
  },
  image: {
    width: "100%",
    height: 360,
    backgroundColor: "#f3f4f6",
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  meta: {
    color: "#6b7280",
    marginTop: 4,
    fontSize: 13,
  },
  bio: {
    marginTop: 8,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
  },
});
