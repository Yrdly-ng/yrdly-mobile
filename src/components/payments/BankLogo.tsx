import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useBankLogos } from '../../hooks/payments/use-bank-logos';
import { StyleSheet } from 'react-native-unistyles';

export function BankLogo({ code, name, size = 24 }: { code: string; name: string; size?: number }) {
  const s = stylesheet;
  const { getBankLogo } = useBankLogos();
  const logoUrl = getBankLogo(code, name);
  const [failedLogo, setFailedLogo] = useState<number | null>(null);

  if (logoUrl && failedLogo !== logoUrl) {
    return (
      <Image
        source={logoUrl}
        accessibilityLabel={name}
        onError={() => setFailedLogo(logoUrl)}
        style={[s.image, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="contain"
        contentPosition="center"
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

const stylesheet = StyleSheet.create((theme) => ({
  image: {
    backgroundColor: '#fff',
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
