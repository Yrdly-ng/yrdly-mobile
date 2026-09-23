import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles, StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';

interface SectionHeaderProps {
  title: string;
  emoji?: string;
  count?: number;
}

export function SectionHeader({ title, emoji, count }: SectionHeaderProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.TEXT_PRIMARY }]}>
        {emoji ? `${emoji} ` : ''}
        {title}
      </Text>
      {count !== undefined && (
        <View style={[styles.badge, { backgroundColor: theme.colors.GLASS_BORDER }]}>
          <Text style={[styles.badgeText, { color: theme.colors.TEXT_SECONDARY }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
