import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export function CampaignBanner() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="YRDLY small businesses campaign. Sell more. Win big. View rules and leaderboard."
      onPress={() => router.push('/campaigns/small-businesses' as never)}
      style={styles.banner}
    >
      <View style={styles.copy}>
        <Text style={styles.kicker}>YRDLY × SMALL BUSINESSES</Text>
        <Text style={styles.title}>Sell More. Win Big.</Text>
        <Text style={styles.detail}>₦500,000 first prize · November 2026</Text>
      </View>
      <Text accessibilityElementsHidden style={styles.arrow}>
        ↗
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F6DB13',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: { flex: 1 },
  kicker: { color: '#075C35', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#12221A', fontSize: 25, fontWeight: '900', marginVertical: 6 },
  detail: { color: '#173D29', fontSize: 12, lineHeight: 19 },
  arrow: { color: '#075C35', fontSize: 32 },
});
