import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { useAuth } from '../../hooks/use-supabase-auth';

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const { theme } = useStyles();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.DARK,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  }

  // Redirect non-admins to the home tab
  if (!profile || profile.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return <Slot />;
}
