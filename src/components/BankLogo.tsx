import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useBankLogos } from '../hooks/use-bank-logos';
import { createStyleSheet, useStyles } from 'react-native-unistyles';

export function BankLogo({ code, name, size = 24 }: { code: string; name: string; size?: number }) {
  const { styles: s, theme } = useStyles(stylesheet);
  const { getBankLogo } = useBankLogos();
  const logoUrl = getBankLogo(code);

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[s.image, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
      />
    );
  }

  // Fallback UI
  const initials = (name || '').substring(0, 2).toUpperCase();
  return (
    <View style={[s.fallbackContainer, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.fallbackText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  image: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.DIVIDER,
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.G + '1A', // 10% opacity roughly
    borderWidth: 1,
    borderColor: theme.colors.G + '33', // 20% opacity roughly
  },
  fallbackText: {
    fontWeight: 'bold',
    color: theme.colors.G,
  },
}));
