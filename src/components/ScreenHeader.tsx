import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MapIcon, NotificationsIcon } from './SvgIcons';
import { useNotificationBadge } from '../context/NotificationBadgeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ScreenHeader({
  title,
  hideIcons,
  rightContent,
}: {
  title: string;
  hideIcons?: boolean;
  rightContent?: React.ReactNode;
}) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { unreadCount } = useNotificationBadge();
  const insets = useSafeAreaInsets();

  return (
    <View style={[stylesheet.container, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }} />
      <Text style={stylesheet.title}>{title}</Text>
      <View style={stylesheet.rightContainer}>
        {!hideIcons && (
          <>
            <TouchableOpacity style={{ marginRight: 16 }} onPress={() => router.push('/map')}>
              <MapIcon size={24} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{ position: 'relative' }}
            >
              <NotificationsIcon size={24} color={theme.colors.TEXT_PRIMARY} />
              {unreadCount > 0 && (
                <View style={[stylesheet.badge, { borderColor: theme.colors.DARK }]}>
                  <Text style={stylesheet.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
        {rightContent}
      </View>
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.DARK,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: theme.colors.TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  rightContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: theme.colors.G,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '800', fontFamily: 'Outfit' },
}));
