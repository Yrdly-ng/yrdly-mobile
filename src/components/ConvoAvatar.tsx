import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Image } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
export type ConvoType = 'friends' | 'marketplace' | 'business';

interface Props {
  avatarId?: string;
  type: ConvoType;
  online?: boolean;
  size?: number;
}

function TagIcon() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  return (
    <Svg width={8} height={8} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
        stroke="#050505"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShopIcon() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  return (
    <Svg width={8} height={8} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="10" width="18" height="11" rx="1" stroke="#050505" strokeWidth="2.5" />
      <Path
        d="M3 10l2-7h14l2 7"
        stroke="#050505"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Conversation avatar with optional context badge overlay.
 * Shows listing type icon (marketplace tag, business storefront) in the corner.
 * Matches Figma Make's ConvoAvatar({ convo }) component.
 */
export function ConvoAvatar({ avatarId, type, online = false, size = 48 }: Props) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const BADGE_ICONS: Record<
    Exclude<ConvoType, 'friends'>,
    { color: string; icon: React.ReactNode }
  > = {
    marketplace: { color: theme.colors.GOLD, icon: <TagIcon /> },
    business: { color: theme.colors.G, icon: <ShopIcon /> },
  };

  const badgeInfo = type !== 'friends' ? BADGE_ICONS[type] : null;
  const badgeSize = Math.round(size * 0.38);

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={{
          uri: avatarId
            ? `https://images.unsplash.com/photo-${avatarId}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format&q=70`
            : `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=${size * 2}&h=${size * 2}&fit=crop&auto=format&q=70`,
        }}
        style={[stylesheet.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />

      {badgeInfo && (
        <View
          style={[
            stylesheet.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badgeInfo.color,
              bottom: -2,
              right: -2,
            },
          ]}
        >
          {badgeInfo.icon}
        </View>
      )}

      {online && (
        <View style={[stylesheet.onlineDot, { bottom: badgeInfo ? badgeSize - 4 : 2, right: 2 }]} />
      )}
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  avatar: {
    backgroundColor: theme.colors.GLASS_BORDER,
  },
  badge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.DARK,
  },
  onlineDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: theme.colors.DARK,
  },
}));
