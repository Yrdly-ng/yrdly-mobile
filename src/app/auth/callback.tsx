import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';

export default function AuthCallback() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [canRetry, setCanRetry] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setCanRetry(true), 15000);
    return () => clearTimeout(timeout);
  }, []);

  // This screen acts as a dummy receiver for the deep link `yrdlymobile://auth/callback`.
  // As soon as this screen mounts (or even before), the Supabase Auth listener in `use-supabase-auth.tsx`
  // will process the session. Once `user` is populated, `RootNavigationGuard` in `_layout.tsx`
  // will automatically redirect the user to the correct screen (like `/(tabs)` or onboarding).

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
      {canRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
          style={{ minHeight: 48, padding: 16, marginTop: 16 }}
        >
          <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
            Having trouble? Return to sign in
          </Text>
        </Pressable>
      )}
    </View>
  );
}
