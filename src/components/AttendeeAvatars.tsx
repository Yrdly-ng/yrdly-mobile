import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { Avatar } from './Avatar';

export interface AttendeeUser {
  id?: string;
  name?: string;
  avatar_url?: string;
}

interface AttendeeAvatarsProps {
  attendees?: (AttendeeUser | string)[];
  totalCount?: number;
  maxVisible?: number;
  size?: number;
  showIcon?: boolean;
  showCountBadge?: boolean;
}

export function AttendeeAvatars({
  attendees = [],
  totalCount,
  maxVisible = 4,
  size = 24,
  showIcon = true,
  showCountBadge = true,
}: AttendeeAvatarsProps) {
  const { theme } = useStyles(createStyleSheet(() => ({})));
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const normalizedAttendees: AttendeeUser[] = attendees.map((item, idx) => {
    if (typeof item === 'string') {
      return { id: item };
    }
    return item;
  });

  const count = totalCount !== undefined ? totalCount : normalizedAttendees.length;

  if (count === 0 && (!normalizedAttendees || normalizedAttendees.length === 0)) {
    return null;
  }

  const visibleAttendees = normalizedAttendees.slice(0, maxVisible);
  const remainingCount = count - visibleAttendees.length;

  const radius = size / 2;
  const borderWidth = 2;
  const overlap = Math.round(size * 0.3);

  return (
    <View style={styles.container}>
      {showIcon && (
        <Ionicons
          name="people-outline"
          size={Math.max(14, Math.round(size * 0.75))}
          color="rgba(255,255,255,0.7)"
          style={styles.icon}
        />
      )}

      <View style={styles.stack}>
        {visibleAttendees.map((user, index) => {
          const hasImage = user?.avatar_url && !failedImages[index];
          const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

          return (
            <View
              key={user?.id || `att-${index}`}
              style={[
                styles.avatarWrapper,
                {
                  width: size,
                  height: size,
                  borderRadius: radius,
                  borderWidth,
                  borderColor: theme.colors.SURFACE_ALT || '#0B0D0B',
                  marginLeft: index === 0 ? 0 : -overlap,
                  zIndex: visibleAttendees.length - index,
                },
              ]}
            >
              <Avatar
                url={user?.avatar_url}
                name={user?.name}
                size={80}
                style={{ width: '100%', height: '100%', borderRadius: radius }}
                fallbackStyle={{ backgroundColor: theme.colors.G + '33' }}
                fallbackTextStyle={{
                  fontSize: Math.max(9, Math.round(size * 0.45)),
                  color: theme.colors.G,
                }}
              />
            </View>
          );
        })}
      </View>

      {showCountBadge && remainingCount > 0 && (
        <View
          style={[
            styles.countBadge,
            {
              height: size,
              minWidth: size,
              borderRadius: radius,
              marginLeft: visibleAttendees.length > 0 ? 6 : 0,
              backgroundColor: 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              {
                fontSize: Math.max(10, Math.round(size * 0.48)),
                color: 'rgba(255,255,255,0.85)',
              },
            ]}
          >
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontWeight: '800',
  },
});
