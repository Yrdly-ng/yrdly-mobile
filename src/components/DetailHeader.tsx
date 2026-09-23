import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

interface Props {
  title: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

function ChevronLeft() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="15 18 9 12 15 6"
        stroke={theme.colors.TEXT_PRIMARY}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Detail screen header with back chevron.
 * Automatically handles status-bar safe area via useSafeAreaInsets.
 * Matches Figma Make's DetailHeader({ title, onBack }) component.
 */
export function DetailHeader({ title, onBack, rightContent }: Props) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[stylesheet.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={handleBack} style={stylesheet.backBtn} hitSlop={12}>
        <ChevronLeft />
      </TouchableOpacity>

      <Text style={stylesheet.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={stylesheet.right}>{rightContent ?? null}</View>
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.DARK,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Outfit',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  right: {
    width: 36,
    alignItems: 'flex-end',
  },
}));
