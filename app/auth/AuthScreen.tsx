import React, { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn() {
    await supabase.auth.signInWithPassword({ email, password });
  }

  async function signUp() {
    await supabase.auth.signUp({ email, password });
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginBottom: 10, padding: 8 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, marginBottom: 10, padding: 8 }}
      />
      <Button title="Sign In" onPress={signIn} />
      <Button title="Sign Up" onPress={signUp} />
    </View>
  );
}
