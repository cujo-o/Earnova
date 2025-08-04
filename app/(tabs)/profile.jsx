import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import {getProfile}  from '@/lib/profile'

const ProfileScreen = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator />;
  if (!profile) return <Text>No profile data</Text>;

  return (
    <View>
      <Text>Username: {profile.username}</Text>
      <Text>Full Name: {profile.fullname}</Text>
    </View>
  );
};

export default ProfileScreen;
 