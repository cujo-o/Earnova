import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getProfile } from '@/lib/profile';

const ProfileScreen = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} />;
  if (!profile) return <Text>No profile data found.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>👤 Profile</Text>
      <Text style={styles.item}>Username: {profile.username}</Text>
      <Text style={styles.item}>Full Name: {profile.fullname}</Text>
      <Text style={styles.item}>Email: {profile.email}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  item: {
    fontSize: 18,
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
});

export default ProfileScreen;
