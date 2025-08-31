// screens/auth/AuthScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If you want to show something when screen mounts / user already logged in,
  // Root layout handles redirecting based on session/profile so we leave it simple.

  const signIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // On success, Supabase auth state changes — Root layout will react
    } catch (e: any) {
      Alert.alert("Sign in error", e.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // After signup, the auth state might or might not include a session depending on your Supabase settings.
      // Root layout listens to auth state and will prompt for profile if the user is signed in.
      Alert.alert("Check your email", "Please confirm your email if required.");
    } catch (e: any) {
      Alert.alert("Sign up error", e.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>Earnova</Text>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === "signin" && styles.tabActive]}
            onPress={() => setMode("signin")}
          >
            <Text
              style={[
                styles.tabText,
                mode === "signin" && styles.tabTextActive,
              ]}
            >
              Sign in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "signup" && styles.tabActive]}
            onPress={() => setMode("signup")}
          >
            <Text
              style={[
                styles.tabText,
                mode === "signup" && styles.tabTextActive,
              ]}
            >
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inputs */}
        <TextInput
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          placeholder="Password"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Button */}
        <TouchableOpacity
          style={styles.btn}
          onPress={mode === "signin" ? signIn : signUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Text>
          )}
        </TouchableOpacity>

        {mode === "signin" && (
          <TouchableOpacity
            style={styles.link}
            onPress={() => Alert.alert("Reset", "Reset flow not implemented")}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    overflow: "hidden",
  },
  tab: { flex: 1, padding: 10, alignItems: "center" },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { fontWeight: "700", color: "#374151" },
  tabTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#2563eb", fontWeight: "600" },
});
