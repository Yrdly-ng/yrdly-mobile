import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LEGAL_LINKS } from '../../lib/legal/terms';

export function LegalLinks({
  color = '#197346',
  includeSafety = false,
}: {
  color?: string;
  includeSafety?: boolean;
}) {
  const links = [
    ['Terms of Service', LEGAL_LINKS.terms],
    ['Privacy Policy', LEGAL_LINKS.privacy],
    ...(includeSafety
      ? [['Trust & Safety', LEGAL_LINKS.safety], ['Child Safety Standards', LEGAL_LINKS.childSafety]]
      : []),
  ];
  return (
    <View style={styles.links}>
      {links.map(([label, url]) => (
        <Pressable
          key={url}
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(url).catch(() =>
              Alert.alert('Unable to open link', 'Please check your connection and try again.')
            );
          }}
          style={styles.link}
        >
          <Text style={[styles.text, { color }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 14, textDecorationLine: 'underline', fontFamily: 'Inter-Medium' },
});
