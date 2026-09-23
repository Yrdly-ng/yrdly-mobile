import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
export type PinType = 'post' | 'marketplace' | 'event' | 'business';

interface Props {
  type: PinType;
  /** Price label, e.g. "₦25,000" — shown on marketplace pins */
  price?: string;
  /** Short badge text, e.g. "NEW" or "FREE" */
  badge?: string;
}

const getPinColors = (theme: any): Record<PinType, string> => ({
  marketplace: theme.colors.GOLD,
  event: theme.colors.BLUE,
  business: theme.colors.G,
  post: theme.colors.SURFACE,
});

const PIN_SIZE = 36;

/**
 * Typed map pin icon for YRDLY dark map.
 * Renders a coloured teardrop pin with an inner icon or price label.
 * Matches Figma Make's MapPinIcon({ type, price?, badge? }) component.
 */
export function MapPinIcon({ type, price, badge }: Props) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const color = getPinColors(theme)[type];

  return (
    <View style={stylesheet.wrapper}>
      {/* Pin body */}
      <View style={[stylesheet.pin, { backgroundColor: color }]}>
        {type === 'marketplace' && price ? (
          <Text style={stylesheet.priceLabel} numberOfLines={1}>
            ₦{price}
          </Text>
        ) : type === 'event' ? (
          <CalendarMini color={theme.colors.TEXT_PRIMARY} />
        ) : type === 'business' ? (
          <StorefrontMini color="#050505" />
        ) : (
          <CommunityMini color={theme.colors.TEXT_PRIMARY} />
        )}
        {badge ? (
          <View style={stylesheet.badge}>
            <Text style={stylesheet.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {/* Tail */}
      <View style={[stylesheet.tail, { borderTopColor: color }]} />
    </View>
  );
}

// ─── Micro icons ──────────────────────────────────────────────────────────────

function CalendarMini({ color }: { color: string }) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function StorefrontMini({ color }: { color: string }) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l1-5h16l1 5M3 9h18M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CommunityMini({ color }: { color: string }) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const _stylesheet = StyleSheet.create((theme) => ({
  wrapper: {
    alignItems: 'center',
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  priceLabel: {
    color: '#000',
    fontFamily: 'Outfit',
    fontSize: 8,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  badgeText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 7,
    fontWeight: '700',
  },
}));
