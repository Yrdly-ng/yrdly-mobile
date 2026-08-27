import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useFollowStatus } from '../hooks/use-follow-status';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';

interface DiscoverUserCardProps {
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    location?: {
      lga?: string;
      state?: string;
    };
    home_state?: string | null;
    home_lga?: string | null;
  };
  context: 'neighbor' | 'mutual' | 'seller';
  mutualCount?: number;
  onPress: () => void;
}

export function DiscoverUserCard({ user, context, mutualCount, onPress }: DiscoverUserCardProps) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { isFollowing, isMutual, actionLoading, toggleFollow } = useFollowStatus(user.id);

  // Derive badge text/icon based on context
  let badgeIcon: keyof typeof Feather.glyphMap = 'map-pin';
  let badgeText = '';

  if (context === 'neighbor') {
    badgeIcon = 'map-pin';
    badgeText = user.home_lga
      ? `${user.home_lga}, ${user.home_state}`
      : user.home_state || user.location?.lga
        ? `${user.location?.lga}, ${user.location?.state}`
        : 'Nearby';
  } else if (context === 'mutual') {
    badgeIcon = 'users';
    badgeText = `${mutualCount || 1} mutual friend${(mutualCount || 1) !== 1 ? 's' : ''}`;
  } else if (context === 'seller') {
    badgeIcon = 'shopping-bag';
    badgeText = 'Active Seller';
  }

  const handleAction = () => {
    toggleFollow();
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={stylesheet.container}>
      <GlassCard
        intensity={80}
        style={StyleSheet.flatten([stylesheet.card, { borderColor: theme.colors.GLASS_BORDER }])}
      >
        <Avatar
          url={user.avatar_url}
          name={user.name}
          size={100}
          style={[stylesheet.avatar as any, { backgroundColor: theme.colors.DARK }]}
          fallbackStyle={{ backgroundColor: theme.colors.G }}
          fallbackTextStyle={{ color: '#000', fontSize: 20, fontWeight: '800' }}
        />

        <View style={stylesheet.content}>
          <Text style={[stylesheet.name, { color: theme.colors.TEXT_PRIMARY }]} numberOfLines={1}>
            {user.name || 'Anonymous'}
          </Text>

          <View style={stylesheet.badgeRow}>
            <Feather name={badgeIcon} size={12} color={theme.colors.TEXT_SECONDARY} />
            <Text
              style={[stylesheet.badgeText, { color: theme.colors.TEXT_SECONDARY }]}
              numberOfLines={1}
            >
              {badgeText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            stylesheet.actionButton,
            isFollowing
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: theme.colors.G + '15' },
            isFollowing && { borderColor: theme.colors.GLASS_BORDER, borderWidth: 1 },
          ]}
          onPress={handleAction}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color={theme.colors.G} />
          ) : isFollowing ? (
            <View style={stylesheet.friendsBadge}>
              <Feather name="check" size={14} color={theme.colors.TEXT_SECONDARY} />
              <Text style={[stylesheet.actionText, { color: theme.colors.TEXT_SECONDARY }]}>
                Following
              </Text>
            </View>
          ) : (
            <Text style={[stylesheet.actionText, { color: theme.colors.G }]}>Follow</Text>
          )}
        </TouchableOpacity>
      </GlassCard>
    </TouchableOpacity>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 13,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  friendsText: {
    fontSize: 13,
    fontWeight: '500',
  },
}));
