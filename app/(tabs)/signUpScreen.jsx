import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { signUp } from "@/lib/auth";
import { updateProfile } from "@/lib/profile";
import { useNavigation } from "@react-navigation/native";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");

  const navigation = useNavigation();

  const handleSignUp = async () => {
    const { user, error } = await signUp(email, password);
    if (error) {
      Alert.alert("Sign Up Error", error.message);
    } else {
      await updateProfile({ username, fullname });
      Alert.alert(
        "Account Created",
        "Please check your email for a verification link."
      );
      navigation.navigate("login");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Account ✨</Text>

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Full Name"
        value={fullname}
        onChangeText={setFullname}
        style={styles.input}
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("login")}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderColor: "#ccc",
    borderWidth: 1,
  },
  button: {
    backgroundColor: "#28a745",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  link: {
    textAlign: "center",
    color: "#007bff",
    textDecorationLine: "underline",
  },
});