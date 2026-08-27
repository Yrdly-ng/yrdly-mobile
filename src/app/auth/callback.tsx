import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { View, ActivityIndicator } from 'react-native';

export default function AuthCallback() {
  const { theme } = useStyles();

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
    </View>
  );
}
