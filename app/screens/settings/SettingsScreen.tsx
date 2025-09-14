// screens/settings/SettingsScreen.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

const items = [
  {
    id: "account",
    label: "Account",
    icon: "person-outline",
    screen: "AccountSettings",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "notifications-outline",
    screen: "NotificationSettings",
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: "lock-closed-outline",
    screen: "PrivacySettings",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "color-palette-outline",
    screen: "AppearanceSettings",
  },
  {
    id: "about",
    label: "About & Help",
    icon: "information-circle-outline",
    screen: "AboutScreen",
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate(item.screen as any)}
          >
            <View style={s.left}>
              <Ionicons name={item.icon} size={20} color="#2563eb" />
              <Text style={s.label}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { marginLeft: 12, fontWeight: "600", fontSize: 16 },
  sep: { height: 1, backgroundColor: "#f3f4f6" },
});
