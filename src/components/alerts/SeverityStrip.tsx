import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SeverityTier } from '../../constants/alerts';

interface SeverityStripProps {
  tier: SeverityTier;
  width?: number;
  isResolved?: boolean;
}

export const SeverityStrip: React.FC<SeverityStripProps> = ({
  tier,
  width = 6,
  isResolved = false,
}) => {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const iconColor = isResolved
    ? theme.colors.LABEL
    : (theme.SEVERITY[tier]?.icon ?? theme.colors.LABEL);

  if (tier === 'urgent' && !isResolved) {
    const darkColor = theme.colors.DARK === '#FFFFFF' ? '#e0e0e0' : '#1a1a1a';
    return (
      <LinearGradient
        colors={[
          iconColor,
          iconColor,
          darkColor,
          darkColor,
          iconColor,
          iconColor,
          darkColor,
          darkColor,
        ]}
        locations={[0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1.0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[stylesheet.strip, { width }]}
      />
    );
  }

  return <View style={[stylesheet.strip, { width, backgroundColor: iconColor }]} />;
};

const _stylesheet = StyleSheet.create(() => ({
  strip: {
    alignSelf: 'stretch',
    borderRadius: 0,
  },
}));
