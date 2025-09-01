// components/SwipeControls.tsx
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  onNope: () => void;
  onLike: () => void;
  onSuper?: () => void;
};

export default function SwipeControls({ onNope, onLike, onSuper }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onNope} style={[styles.btn, styles.nope]}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onSuper} style={[styles.btn, styles.super]}>
        <Ionicons name="star" size={18} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onLike} style={[styles.btn, styles.like]}>
        <Ionicons name="heart" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 18,
    marginBottom: 24,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  nope: {
    backgroundColor: "#ef4444",
  },
  super: {
    backgroundColor: "#9ca3af",
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  like: {
    backgroundColor: "#10b981",
  },
});
