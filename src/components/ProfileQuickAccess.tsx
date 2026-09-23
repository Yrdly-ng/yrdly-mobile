import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';

export interface ProfileQuickAccessProps {
  /**
   * Callback invoked when "My Business" is tapped.
   * Handles business existence checks, phone verification, and routing.
   */
  onManageStore: () => void;
}

/**
 * ProfileQuickAccess (Option A — Circle Icons)
 * Renders a horizontal row of 4 Quick Access circular action buttons:
 * Tickets, My Events, My Business, My Listings.
 */
export default function ProfileQuickAccess({ onManageStore }: ProfileQuickAccessProps) {
  const { theme } = useUnistyles(); const styles = _stylesheet;
  const router = useRouter();

  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePressIn = (index: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setActiveTooltipIndex(index);
  };

  const handlePressOut = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveTooltipIndex(null);
    }, 1200);
  };

  const items = [
    {
      key: 'tickets',
      label: 'Tickets',
      sub: 'Your tickets',
      icon: (color: string) => <MaterialCommunityIcons name="ticket-outline" size={18} color={color} />,
      onPress: () => router.push('/tickets'),
    },
    {
      key: 'events',
      label: 'My Events',
      sub: 'Events you run',
      icon: (color: string) => <Ionicons name="calendar-outline" size={18} color={color} />,
      onPress: () => router.push('/my-events' as any),
    },
    {
      key: 'business',
      label: 'My Business',
      sub: 'Business presence',
      icon: (color: string) => <Ionicons name="storefront-outline" size={18} color={color} />,
      onPress: onManageStore,
    },
    {
      key: 'listings',
      label: 'My Listings',
      sub: 'Manage items',
      icon: (color: string) => <Feather name="shopping-bag" size={18} color={color} />,
      onPress: () => router.push('/my-listings' as any),
    },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isTooltipVisible = activeTooltipIndex === index;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.itemButton}
            activeOpacity={0.7}
            onPress={item.onPress}
            onPressIn={() => handlePressIn(index)}
            onPressOut={handlePressOut}
          >
            {isTooltipVisible && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>{item.sub}</Text>
              </View>
            )}
            <View style={styles.circleIcon}>
              {item.icon(theme.colors.G)}
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  itemButton: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  circleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.G + '1F', // ~12% opacity green
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  tooltip: {
    position: 'absolute',
    top: -32,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.G + '40',
    zIndex: 10,
    elevation: 4,
  },
  tooltipText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: theme.colors.G,
  },
}));
