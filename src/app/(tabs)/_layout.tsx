import { StyleSheet, useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { Tabs, useRouter } from 'expo-router';
import { View, Platform, Text, TouchableOpacity, Alert, AppState } from 'react-native';
import { Plus } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import { HomeIcon, ExploreIcon, MessagesIcon, ProfileIcon } from '../../components/SvgIcons';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { PencilSimple, Storefront, CalendarBlank, WarningCircle, X } from 'phosphor-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useToast } from '../../components/toast';
import { getActiveConversationId } from '../../lib/active-chat-tracker';
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/** Wraps any tab icon with a spring scale animation on focus */
function TabIconWrapper({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = focused
      ? withSpring(1.22, { damping: 12, stiffness: 260 })
      : withSpring(1, { damping: 14, stiffness: 200 });
  }, [focused]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Floating create button with spring press feedback */
function FloatingCreateButton({ onPress }: { onPress: () => void }) {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedTouchableOpacity
      style={[styles.createButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Plus size={26} color={theme.colors.TEXT_PRIMARY} weight="bold" />
    </AnimatedTouchableOpacity>
  );
}

const TAB_BAR_HEIGHT = 64;

function CreateMenuOverlay({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (route: string) => void;
}) {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  if (!visible) return null;

  const { profile } = useAuth();

  const OPTIONS = [
    {
      id: 'post',
      title: 'Create Post',
      desc: 'Share thoughts or photos',
      icon: PencilSimple,
      route: '/create-post',
    },
    {
      id: 'listing',
      title: 'Create Listing',
      desc: 'Sell or give away items',
      icon: Storefront,
      route: '/create-for-sale',
    },
    {
      id: 'event',
      title: 'Create Event',
      desc: 'Host a gathering or party',
      icon: CalendarBlank,
      route: '/create-event',
    },
    {
      id: 'alert',
      title: 'Publish Alert',
      desc: 'Notify neighbors of danger',
      icon: WarningCircle,
      route: '/create-alert',
    },
  ];

  const handleSelect = (route: string) => {
    if (!profile?.phone_verified && (route === '/create-for-sale' || route === '/create-event')) {
      Alert.alert(
        'Verification Required',
        'You must verify your phone number to post events or listings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify Now',
            onPress: () => {
              onClose();
              onSelect('/verify-phone');
            },
          },
        ]
      );
      return;
    }
    onSelect(route);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
    >
      <BlurView
        intensity={80}
        tint={UnistylesRuntime.themeName === 'dark' ? 'dark' : 'light'}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor:
              UnistylesRuntime.themeName === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.7)',
          }}
        />
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
      </BlurView>
      <Animated.View
        entering={SlideInDown.duration(300).springify()}
        exiting={SlideOutDown.duration(200)}
        style={styles.overlayContent}
      >
        <View style={styles.optionsContainer}>
          {OPTIONS.map((opt, idx) => {
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.8}
                style={styles.optionBtn}
                onPress={() => handleSelect(opt.route)}
              >
                <View style={styles.optionIconWrap}>
                  <opt.icon size={24} color={theme.colors.G} weight="regular" />
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
          <X size={24} color={theme.colors.TEXT_PRIMARY} weight="bold" />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { theme } = useUnistyles(); const styles = sStylesheet;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useAppTheme();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Stable ref so the realtime callback always calls the latest fetcher
  // without needing to re-subscribe whenever profile changes.
  const fetchUnreadRef = useRef<() => Promise<void>>(async () => {});
  const blockedUsersKey = JSON.stringify(profile?.blocked_users ?? []);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      let unreadTotal = 0;

      const { data: convs } = await supabase
        .from('conversations')
        .select('id, type, deleted_by, participant_ids')
        .contains('participant_ids', [user.id]);

      if (convs) {
        const blockedUsers: string[] = profile?.blocked_users ?? [];
        const activeConvs = convs.filter((c) => {
          if (c.deleted_by && c.deleted_by.includes(user.id)) return false;
          const otherId = c.participant_ids?.find((id: string) => id !== user.id);
          if (otherId && blockedUsers.includes(otherId)) return false;
          return true;
        });

        const activeConvIds = activeConvs.map((c) => c.id);

        if (activeConvIds.length > 0) {
          const { data: unreadData } = await supabase
            .from('messages')
            .select('conversation_id')
            .eq('is_read', false)
            .neq('sender_id', user.id)
            .not('deleted_by', 'cs', `{${user.id}}`)
            .in('conversation_id', activeConvIds);

          if (unreadData) {
            unreadTotal += unreadData.length;
          }
        }
      }

      setUnreadMessages(unreadTotal);
    };

    fetchUnreadRef.current = fetchUnread;
    fetchUnread();
  }, [user, blockedUsersKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchUnreadRef.current();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Separate effect: subscribe once per user, call via ref to avoid re-subscribing
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages_badge_${user.id}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload: any) => {
        fetchUnreadRef.current();

        if (payload.eventType === 'INSERT' && payload.new) {
          const msg = payload.new;
          if (msg.sender_id === user.id) return;
          if (msg.conversation_id === getActiveConversationId()) return;

          let senderName = 'Someone';
          if (msg.sender_id) {
            const { data: senderData } = await supabase
              .from('users')
              .select('name')
              .eq('id', msg.sender_id)
              .maybeSingle();
            if (senderData?.name) {
              senderName = senderData.name;
            }
          }

          showToast({
            message: `New message from ${senderName}`,
            actionText: 'View',
            onActionPress: () => {
              router.push(`/chat/${msg.conversation_id}` as any);
            },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Escrow status realtime notifications
  const notifiedEscrowStatusRef = useRef(new Map<string, string>());

  useEffect(() => {
    if (!user) return;

    const escrowChannel = supabase
      .channel(`escrow_status_${user.id}_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'escrow_transactions' },
        (payload: any) => {
          const newTx = payload.new;

          if (!newTx?.id || !newTx?.status) return;

          if (notifiedEscrowStatusRef.current.get(newTx.id) === newTx.status) return;
          notifiedEscrowStatusRef.current.set(newTx.id, newTx.status);

          let toastMessage: string | null = null;

          if (newTx.status === 'paid' && user.id === newTx.seller_id) {
            toastMessage = 'Payment received — you can now ship the item';
          } else if (newTx.status === 'shipped' && user.id === newTx.buyer_id) {
            toastMessage = 'Your item is on its way';
          } else if (newTx.status === 'delivered' && user.id === newTx.seller_id) {
            toastMessage = 'Buyer confirmed delivery';
          } else if (newTx.status === 'completed' && user.id === newTx.seller_id) {
            toastMessage = 'Funds released to your account';
          }

          if (toastMessage) {
            showToast({
              message: toastMessage,
              actionText: 'View',
              onActionPress: () => {
                router.push(`/transactions/${newTx.id}` as any);
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(escrowChannel);
    };
  }, [user]);

  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: tabBarHeight,
            backgroundColor: theme.colors.GLASS_BG,
            borderTopWidth: 1,
            borderTopColor: theme.colors.GLASS_BORDER,
            paddingBottom: insets.bottom,
            elevation: 0,
          },
          tabBarActiveTintColor: theme.colors.G,
          tabBarInactiveTintColor: theme.colors.LABEL,
          tabBarLabel: ({ focused, color }) => {
            return (
              <Text
                style={{
                  color,
                  fontFamily: focused ? 'Inter-SemiBold' : 'Inter-Regular',
                  fontSize: 10,
                }}
              >
                {/* The label text is determined by the route title or passed down */}
              </Text>
            );
          },
          tabBarItemStyle: {
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => {
              return (
                <TabIconWrapper focused={focused}>
                  <HomeIcon color={focused ? theme.colors.G : color} size={26} filled={focused} />
                </TabIconWrapper>
              );
            },
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, focused }) => {
              return (
                <TabIconWrapper focused={focused}>
                  <ExploreIcon
                    color={focused ? theme.colors.G : color}
                    size={26}
                    filled={focused}
                  />
                </TabIconWrapper>
              );
            },
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarItemStyle: {
              // Push the item down so the circle floats above the bar
              paddingTop: Platform.OS === 'ios' ? 0 : 4,
            },
            tabBarIcon: () => <FloatingCreateButton onPress={() => setShowCreateMenu(true)} />,
          }}
          listeners={{
            tabPress: (e: any) => {
              e.preventDefault();
              setShowCreateMenu(true);
            },
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => {
              return (
                <TabIconWrapper focused={focused}>
                  <View>
                    <MessagesIcon
                      color={focused ? theme.colors.G : color}
                      size={26}
                      filled={focused}
                    />
                    {unreadMessages > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </Text>
                      </View>
                    )}
                  </View>
                </TabIconWrapper>
              );
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => {
              return (
                <TabIconWrapper focused={focused}>
                  <ProfileIcon
                    color={focused ? theme.colors.G : color}
                    size={26}
                    filled={focused}
                  />
                </TabIconWrapper>
              );
            },
          }}
        />
      </Tabs>

      <CreateMenuOverlay
        visible={showCreateMenu}
        onClose={() => setShowCreateMenu(false)}
        onSelect={(route) => {
          setShowCreateMenu(false);
          router.push(route as any);
        }}
      />
    </View>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  createButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 12 : 8,
    shadowColor: theme.colors.G,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: theme.colors.G,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: theme.colors.DARK,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontFamily: 'Outfit-ExtraBold',
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  optionsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 16,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(130,219,126,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  optionDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.MUTED,
  },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.SURFACE_ALT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
}));
