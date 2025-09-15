import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import {
  NavigationContainer,
  NavigationIndependentTree,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/lib/auth";

import AuthScreen from "./auth/AuthScreen";
import ListingsScreen from "./screens/ListingsScreen";
import AddPostScreen from "./screens/AddPostScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ChatScreen from "./screens/ChatScreen";
import HomeScreen from "./screens/HomeScreen";
import ProductDetailsScreen from "@/components/mods/ProductDetailsScreen";
import EditListingScreen from "@/components/mods/EditListingScreen";
import EditProfileScreen from "@/components/mods/EditProfileScreen";
import ChatListScreen from "@/components/mods/ChatListScreen";
import RoommateSwipeScreen from "./screens/RoommateSwipeScreen";
import CreateProfileModal from "@/components/mods/CreateProfileModal";
import Ionicons from "@expo/vector-icons/Ionicons";
//settings import
import SettingsScreen from "./screens/settings/SettingsScreen";
import AccountSettings from "./screens/settings/AccountSettings";
import NotificationSettings from "./screens/settings/NotificationSettings";
import PrivacySettings from "./screens/settings/PrivacySettings";
import AppearanceSettings from "./screens/settings/AppearanceSettings";
import AboutScreen from "./screens/settings/AboutScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: string = "";

          if (route.name === "Home") iconName = "home-outline";
          else if (route.name === "Explore") iconName = "search-outline";
          else if (route.name === "AddPost") iconName = "add-circle-outline";
          else if (route.name === "RoommateSwipe") iconName = "people-outline";
          else if (route.name === "chats") iconName = "chatbubble-outline";
          else if (route.name === "Profile") iconName = "person-outline";

          return (
            <Ionicons
              name={iconName as keyof typeof Ionicons.glyphMap}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ListingsScreen} />
      <Tab.Screen name="AddPost" component={AddPostScreen} />
      <Tab.Screen name="RoommateSwipe" component={RoommateSwipeScreen} />
      <Tab.Screen name="chats" component={ChatListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      // get the current user (if any)
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!mounted) return;
      setUser(u);
      if (u) {
        setCurrentUserId(u.id);
        // check for profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", u.id)
          .maybeSingle();
        setShowProfileModal(!profile);
      } else {
        setShowProfileModal(false);
        setCurrentUserId(null);
      }
      setLoading(false);
    };

    init();

    // subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (!u) {
          setShowProfileModal(false);
          setCurrentUserId(null);
        } else {
          setCurrentUserId(u.id);
          (async () => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", u.id)
              .maybeSingle();
            setShowProfileModal(!profile);
          })();
        }
      }
    );

    return () => {
      mounted = false;
      // cleanup listener
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // called after profile created inside modal
  const handleProfileCreated = async () => {
    // re-check profile and then hide modal
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .maybeSingle();

    setShowProfileModal(!profile);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="Tabs" component={Tabs} />
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}

          <Stack.Screen
            name="ProductDetails"
            component={ProductDetailsScreen}
          />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="EditListing" component={EditListingScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="AccountSettings" component={AccountSettings} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettings}
          />
          <Stack.Screen name="PrivacySettings" component={PrivacySettings} />
          <Stack.Screen
            name="AppearanceSettings"
            component={AppearanceSettings}
          />
          <Stack.Screen name="AboutScreen" component={AboutScreen} />
        </Stack.Navigator>

        {/* Modal overlay — forced when showProfileModal is true */}
        {user && currentUserId && (
          <CreateProfileModal
            visible={showProfileModal}
            userId={currentUserId}
            requireComplete={true}
            onCreated={handleProfileCreated}
          />
        )}
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

export default function App() {
  return (
    <AuthProvider>
        <RootNavigator />
    </AuthProvider>
  );
}
