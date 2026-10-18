import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

/**
 * YRDLY verified checkmark badge.
 * Render next to any verified user name or business name.
 *
 * Usage:
 *   {user.verified && <VerifiedBadge size={16} />}
 */
export function VerifiedBadge({ size = 20, color }: Props) {
  const { theme } = useUnistyles();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 1.5 14.6 3l3-.1 1.5 2.6 2.6 1.5-.1 3L23 12l-1.4 2.6.1 3-2.6 1.5-1.5 2.6-3-.1L12 23l-2.6-1.4-3 .1-1.5-2.6-2.6-1.5.1-3L1 12l1.4-2.6-.1-3 2.6-1.5 1.5-2.6 3 .1L12 1.5z"
        fill={color || theme.colors.G}
      />
      <Path
        d="m8 12.3 2.6 2.5 5.5-5.6"
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BusinessBadge({ size = 20 }: Props) {
  const { theme } = useUnistyles();
  return <VerifiedBadge size={size} color="#FBBF24" />; // Yellow for business
}

export function MarketplaceBadge({ size = 20 }: Props) {
  const { theme } = useUnistyles();
  // Using a distinct SVG path for a "store/shopping" badge to differentiate from the checkmark
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20 7h-4V5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v2H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V9c0-1.103-.897-2-2-2zm-6-2v2h-4V5h4zM4 9h16v10H4V9z"
        fill={theme.colors.G} // Green
      />
    </Svg>
  );
}
