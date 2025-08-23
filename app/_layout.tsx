import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "@/lib/auth";

import AuthScreen from "./auth/AuthScreen";
import ListingsScreen from "./screens/ListingsScreen";
import AddPostScreen from "./screens/AddPostScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ChatScreen from "./screens/ChatScreen";
import HomeScreen from "./screens/HomeScreen";
import ProductDetailsScreen from "@/components/mods/ProductDetailsScreen";
import EditListingScreen from "@/components/mods/EditListingScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ListingsScreen} />
      <Tab.Screen name="AddPost" component={AddPostScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="chat" component={ChatScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null; // could show splash

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Tabs" component={Tabs} />
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}

      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="EditListing" component={EditListingScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
