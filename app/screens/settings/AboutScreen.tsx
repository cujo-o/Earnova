// screens/settings/AboutScreen.tsx
import React from "react";
import { View, Text, StyleSheet, Linking } from "react-native";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earnova</Text>
      <Text style={styles.text}>
        A simple marketplace & roommate-finder for students.
      </Text>
      <Text style={[styles.text, { marginTop: 12 }]}>
        Need help?{" "}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL("mailto:help@example.com")}
        >
          Contact support
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "800" },
  text: { marginTop: 8, color: "#374151" },
  link: { color: "#2563eb", fontWeight: "700" },
});
