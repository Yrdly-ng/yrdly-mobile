import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../hooks/use-supabase-auth';

export default function NewPostScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { profile } = useAuth();

  useEffect(() => {
    if (params.category === 'Event') {
      if (profile && !profile.phone_verified) {
        Alert.alert(
          'Verification Required',
          'You must verify your phone number to create an event.'
        );
        router.back();
        return;
      }
      router.replace('/create-event' as any);
    } else {
      router.replace('/create-post' as any);
    }
  }, [params.category, router]);

  return (
    <View style={stylesheet.container}>
      <ActivityIndicator size="large" color={theme.colors.G} />
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
