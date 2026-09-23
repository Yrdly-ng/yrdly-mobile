import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/use-supabase-auth';

export default function Index() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
