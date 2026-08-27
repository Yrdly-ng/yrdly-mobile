import { createStyleSheet, useStyles } from 'react-native-unistyles';
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
  const { theme } = useStyles();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z"
        fill={color || theme.colors.G}
      />
    </Svg>
  );
}

export function BusinessBadge({ size = 20 }: Props) {
  const { theme } = useStyles();
  return <VerifiedBadge size={size} color="#FBBF24" />; // Yellow for business
}

export function MarketplaceBadge({ size = 20 }: Props) {
  const { theme } = useStyles();
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
