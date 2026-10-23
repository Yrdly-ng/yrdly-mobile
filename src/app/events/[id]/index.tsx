import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  Platform,
  Share,
  DeviceEventEmitter,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../../../lib/supabase/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { useNotificationRouteAcknowledgement } from '../../../hooks/notifications/use-notification-route-ack';
import { Event, TicketTier } from '../../../types/events';
import { getEventById } from '../../../lib/events/event-service';
import { api, WEB_APP_URL } from '../../../lib/network/api';
import { PaylukCheckout } from '../../../components/payments/PaylukCheckout';
import { formatPrice } from '../../../lib/shared/utils';
import { eventScreenStyles as eventUI } from '../../../components/events/event-screen-styles';
import { getEventDateInfo } from '../../../lib/events/event-presentation';
import { AttendeeAvatars } from '../../../components/events/AttendeeAvatars';
import { VerifiedBadge } from '../../../components/VerifiedBadge';
import { directionsHref } from '../../../lib/location/directions';

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2236' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0f' }] },
];

// Custom Skeleton Component
const SkeletonCard = ({ height = 20, width = '100%', style }: any) => {
  const { theme } = useUnistyles();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { height, width, backgroundColor: theme.colors.GLASS_BORDER, borderRadius: 8 },
        style,
        animStyle,
      ]}
    />
  );
};

export default function EventDetailScreen() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const eventScrollRef = useRef<Animated.ScrollView>(null);
  const ticketSectionY = useRef(0);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  useNotificationRouteAcknowledgement(!loading && !!event);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFollowingOrganizer, setIsFollowingOrganizer] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  // Ticket Purchase State
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const purchaseInFlight = useRef(false);
  const verifyInFlight = useRef(false);
  const [ticketCheckout, setTicketCheckout] = useState<{
    paymentToken: string;
    transactionId: string;
    txRef: string;
    customerId: string;
    tierName: string;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [userHasTickets, setUserHasTickets] = useState(false);

  // Ticket success overlay
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [successTierName, setSuccessTierName] = useState('');
  const successSheetY = useSharedValue(400);
  const successOverlayOp = useSharedValue(0);
  const successContentOp = useSharedValue(0);
  const successContentY = useSharedValue(20);

  const successOverlayStyle = useAnimatedStyle(() => ({ opacity: successOverlayOp.value }));
  const successSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: successSheetY.value }],
  }));
  const successContentStyle = useAnimatedStyle(() => ({
    opacity: successContentOp.value,
    transform: [{ translateY: successContentY.value }],
  }));

  function showTicketSuccess(tierName: string) {
    setSuccessTierName(tierName);
    setTicketSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    successOverlayOp.value = withTiming(1, { duration: 250 });
    successSheetY.value = withSpring(0, { damping: 22, stiffness: 200 });
    successContentOp.value = withDelay(280, withTiming(1, { duration: 380 }));
    successContentY.value = withDelay(280, withSpring(0, { damping: 18, stiffness: 140 }));
  }

  function dismissTicketSuccess() {
    successOverlayOp.value = withTiming(0, { duration: 200 });
    successSheetY.value = withSpring(400, { damping: 22, stiffness: 200 });
    setTimeout(() => {
      setTicketSuccess(false);
      setSelectedTier(null);
      setQuantity(1);
      fetchEvent();
    }, 220);
  }

  function getDirections() {
    if (!event || event.location_online) return;
    router.push(directionsHref({ type: 'event', id: event.id }) as any);
  }

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getEventById(id as string);
      if (data) {
        setEvent(data);

        if (user) {
          // Check bookmark
          if (!user || !profile) return;
          const { data: bData } = await supabase
            .from('event_bookmarks')
            .select('id')
            .eq('user_id', profile.id)
            .eq('event_id', data.id)
            .maybeSingle();
          setIsBookmarked(!!bData);

          // Check follow
          if (data.organizer_id) {
            const { data: fData } = await supabase
              .from('followers')
              .select('id')
              .eq('follower_id', profile.id)
              .eq('following_id', data.organizer_id)
              .maybeSingle();
            setIsFollowingOrganizer(!!fData);
          }

          // Check if user has tickets
          const { data: tData } = await supabase
            .from('tickets')
            .select('id')
            .eq('buyer_id', profile.id)
            .eq('event_id', data.id)
            .limit(1);
          if (tData && tData.length > 0) {
            setUserHasTickets(true);
          }
        }

        // Fetch related events (filtered by same LGA/state location)
        let relatedQuery = supabase
          .from('events')
          .select(
            `id, title, cover_image_url, start_time, location_address, location_online, state, lga`
          )
          .eq('status', 'PUBLISHED')
          .or(
            `end_time.gte.${new Date().toISOString()},and(end_time.is.null,start_time.gte.${new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()})`
          )
          .neq('id', data.id);

        if (data.lga) {
          relatedQuery = relatedQuery.eq('lga', data.lga);
        } else if (data.state) {
          relatedQuery = relatedQuery.eq('state', data.state);
        }

        const { data: related } = await relatedQuery.limit(5);
        if (related) setRelatedEvents(related);
      } else {
        Alert.alert('Event Unavailable', 'This event is no longer available.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Event Unavailable', 'Unable to load event details.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchEvent();

    if (!id) return;
    const channel = supabase
      .channel(`public:events:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` },
        () => {
          fetchEvent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `event_id=eq.${id}` },
        () => {
          fetchEvent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchEvent]);

  useEffect(() => {
    if (user) {
      setAttendeeEmail(user.email || '');
      setAttendeeName(profile?.name || user.user_metadata?.name || '');
    }
  }, [user, profile]);

  const handleShare = async () => {
    if (!event) return;
    try {
      const url = `https://app.yrdly.ng/events/${event.id}`;
      await Share.share({
        message: `Check out ${event.title} on YRDLY! ${url}`,
        url: url,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleBookmark = async () => {
    if (!user || !profile || !event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newBookmarked = !isBookmarked;
    setIsBookmarked(newBookmarked);

    if (newBookmarked) {
      const { error } = await supabase
        .from('event_bookmarks')
        .insert({ user_id: profile.id, event_id: event.id });
      if (error) setIsBookmarked(false);
    } else {
      const { error } = await supabase
        .from('event_bookmarks')
        .delete()
        .match({ user_id: profile.id, event_id: event.id });
      if (error) setIsBookmarked(true);
    }
  };

  const handleFollow = async () => {
    if (!user || !profile || !event?.organizer_id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isFollowingOrganizer) {
        setIsFollowingOrganizer(false);
        await supabase
          .from('followers')
          .delete()
          .match({ follower_id: profile.id, following_id: event.organizer_id });
      } else {
        setIsFollowingOrganizer(true);
        await supabase
          .from('followers')
          .insert({ follower_id: profile.id, following_id: event.organizer_id });
      }
    } catch (e) {
      console.error(e);
      setIsFollowingOrganizer(!isFollowingOrganizer); // Revert
    }
  };

  const handleDeleteEvent = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('events')
                .update({ is_archived: true, status: 'CANCELLED' })
                .eq('id', event!.id)
                .eq('organizer_id', user!.id);
              if (error) throw error;
              DeviceEventEmitter.emit('post_deleted', event!.id);
              router.back();
            } catch (e: any) {
              console.error('Delete event error:', e);
              Alert.alert('Error', e.message || 'Could not delete event.');
            }
          },
        },
      ]
    );
  };

  const verifyTicketCheckout = async () => {
    if (!ticketCheckout || verifyInFlight.current) return;
    verifyInFlight.current = true;
    const checkout = ticketCheckout;
    setTicketCheckout(null);
    setPurchasing(true);
    try {
      const result = await api.post<{ success: boolean }>('/api/events/tickets/verify', {
        tx_ref: checkout.txRef,
      });
      if (!result.success) throw new Error('Payment has not been confirmed.');
      setSelectedTier(null);
      showTicketSuccess(checkout.tierName);
    } catch {
      Alert.alert(
        'Payment awaiting confirmation',
        'Check My Tickets before paying again. Your ticket will appear after payment is verified.',
        [{ text: 'My Tickets', onPress: () => router.push('/tickets' as any) }]
      );
    } finally {
      verifyInFlight.current = false;
      setPurchasing(false);
    }
  };

  const handlePurchase = async () => {
    if (!event || !selectedTier || purchaseInFlight.current) return;
    if (!attendeeName.trim() || !attendeeEmail.trim()) {
      Alert.alert('Error', 'Please enter your name and email.');
      return;
    }
    if (selectedTier.price > 0 && !process.env.EXPO_PUBLIC_PAYLUK_PUBLIC_KEY) {
      Alert.alert(
        'Payments unavailable',
        'Secure checkout is unavailable. Please try again later.'
      );
      return;
    }
    purchaseInFlight.current = true;
    setPurchasing(true);
    try {
      const result = await api.post('/api/events/tickets/purchase', {
        event_id: event.id,
        tier_id: selectedTier.id,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        quantity,
      });
      if (!result.success) throw new Error('Could not start checkout.');
      if (result.free || result.alreadyPaid) {
        const tierName = selectedTier.name;
        setSelectedTier(null);
        showTicketSuccess(tierName);
      } else if (
        result.paylukPaymentToken &&
        result.buyerPaylukId &&
        result.tx_ref &&
        result.transactionId
      ) {
        setTicketCheckout({
          paymentToken: result.paylukPaymentToken,
          transactionId: result.transactionId,
          customerId: result.buyerPaylukId,
          txRef: result.tx_ref,
          tierName: selectedTier.name,
        });
      } else throw new Error('Checkout setup is incomplete. Please contact support.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not process ticket purchase.');
    } finally {
      purchaseInFlight.current = false;
      setPurchasing(false);
    }
  };

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    return { opacity, backgroundColor: theme.colors.DARK };
  });

  const getEventStatus = (ev: Event) => {
    if (ev.status === 'CANCELLED') return { label: 'Cancelled', color: '#EF4444' };
    const now = new Date().getTime();
    const start = ev.start_time ? new Date(ev.start_time).getTime() : 0;
    const end = ev.end_time ? new Date(ev.end_time).getTime() : 0;

    if (end && now > end) return { label: 'Ended', color: '#6B7280' };
    if (start && now > start && (!end || now < end)) return { label: 'Live Now', color: '#EF4444' };
    if (start && start - now < 86400000 && start > now)
      return { label: 'Starting Soon', color: '#F59E0B' };
    return { label: 'Upcoming', color: theme.colors.G };
  };

  const scrollToTickets = () => {
    eventScrollRef.current?.scrollTo({
      y: ticketSectionY.current + width * 0.9 - insets.top - 76,
      animated: true,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={stylesheet.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={stylesheet.iconBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Event Details
          </Text>
          <View style={stylesheet.headerRightActions}>
            <View style={stylesheet.iconBtn} />
            <View style={stylesheet.iconBtn} />
          </View>
        </View>
        <ScrollView style={stylesheet.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonCard height={width * 0.8} style={{ borderRadius: 0 }} />
          <View style={stylesheet.infoSection}>
            <SkeletonCard height={32} width="80%" style={{ marginBottom: 16 }} />
            <SkeletonCard height={120} style={{ borderRadius: 20, marginBottom: 24 }} />
            <SkeletonCard height={80} style={{ borderRadius: 20, marginBottom: 24 }} />
            <SkeletonCard height={100} style={{ borderRadius: 20, marginBottom: 24 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[stylesheet.centerContainer, { backgroundColor: theme.colors.DARK }]}>
        <Text style={[stylesheet.errorText, { color: theme.colors.TEXT_PRIMARY }]}>
          Event unavailable or deleted
        </Text>
        <TouchableOpacity
          style={[stylesheet.backBtnWrapper, { backgroundColor: theme.colors.SURFACE }]}
          onPress={() => router.back()}
        >
          <Text style={[stylesheet.backBtnText, { color: theme.colors.TEXT_PRIMARY }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const imageUrls =
    (event as any).image_urls && (event as any).image_urls.length > 0
      ? (event as any).image_urls
      : event.cover_image_url
        ? [event.cover_image_url]
        : [];
  const isOwner = user?.id === event.organizer_id;
  const statusObj = getEventStatus(event);
  const isExpired = statusObj.label === 'Ended' || statusObj.label === 'Cancelled';
  const visibleTiers = event.ticket_tiers?.filter((tier) => tier.is_visible) || [];
  const allTicketsSoldOut =
    visibleTiers.length > 0 && visibleTiers.every((tier) => tier.is_sold_out);
  const noTickets = visibleTiers.length === 0;
  const dateInfo = getEventDateInfo(event.start_time);

  const formattedDate = dateInfo?.full || 'Date to be announced';
  const formattedTime = dateInfo?.time || 'Time to be announced';

  return (
    <View style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <Animated.View style={[stylesheet.stickyHeader, headerAnimatedStyle, { zIndex: 10 }]}>
        <SafeAreaView edges={['top']} />
      </Animated.View>

      <SafeAreaView
        edges={['top']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}
        pointerEvents="box-none"
      >
        <View style={stylesheet.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[stylesheet.iconBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={stylesheet.headerRightActions}>
            {isOwner && isExpired && (
              <TouchableOpacity
                onPress={handleDeleteEvent}
                style={[
                  stylesheet.iconBtn,
                  { backgroundColor: 'rgba(229, 57, 53, 0.2)', marginRight: 8 },
                ]}
              >
                <Feather name="trash-2" size={20} color="#E53935" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Share event"
              onPress={handleShare}
              style={[stylesheet.iconBtn, { backgroundColor: 'rgba(0,0,0,0.4)', marginRight: 8 }]}
            >
              <Feather name="share" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isBookmarked ? 'Unsave event' : 'Save event'}
              accessibilityState={{ selected: isBookmarked }}
              onPress={handleBookmark}
              style={[stylesheet.iconBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isBookmarked ? '#82DB7E' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        ref={eventScrollRef}
        style={stylesheet.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 125 + insets.bottom }}
      >
        {/* HERO GALLERY */}
        <View style={stylesheet.heroContainer}>
          {imageUrls.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
            >
              {imageUrls.map((uri: string, idx: number) => {
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    onPress={() => {
                      setCurrentImageIndex(idx);
                      setIsGalleryVisible(true);
                    }}
                  >
                    <Image source={{ uri }} style={stylesheet.mainImage} contentFit="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[stylesheet.placeholderImage, { backgroundColor: theme.colors.SURFACE }]}>
              <Ionicons name="calendar-outline" size={64} color={theme.colors.LABEL} />
            </View>
          )}
          {imageUrls.length > 1 && (
            <View style={stylesheet.galleryBadge}>
              <Text style={stylesheet.galleryBadgeText}>
                {currentImageIndex + 1}/{imageUrls.length}
              </Text>
            </View>
          )}
          {imageUrls.length > 1 && (
            <View style={stylesheet.dotsContainer}>
              {imageUrls.map((_: string, idx: number) => (
                <View
                  key={idx}
                  style={[
                    stylesheet.dot,
                    {
                      backgroundColor:
                        idx === currentImageIndex ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={stylesheet.infoSection}>
          <Text style={[eventUI.eyebrow, { marginBottom: 12 }]}>YOUR NEXT GOOD PLAN</Text>
          {/* TITLE & STATUS */}
          <View style={stylesheet.titleRow}>
            <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>
              {event.title}
            </Text>
            <View style={[stylesheet.statusBadge, { backgroundColor: statusObj.color + '20' }]}>
              <Text style={[stylesheet.statusBadgeText, { color: statusObj.color }]}>
                {statusObj.label}
              </Text>
            </View>
          </View>

          {/* AT A GLANCE */}
          <Text style={[eventUI.sectionTitle, { marginBottom: 14 }]}>The plan</Text>
          <View
            style={[
              stylesheet.premiumCard,
              stylesheet.infoGrid,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <View style={stylesheet.infoRow}>
              <View style={[stylesheet.iconBox, { backgroundColor: theme.colors.G + '15' }]}>
                <Feather name="calendar" size={20} color={theme.colors.G} />
              </View>
              <View style={stylesheet.infoTextContainer}>
                <Text style={[stylesheet.infoLabel, { color: theme.colors.LABEL }]}>Date</Text>
                <Text style={[stylesheet.infoValue, { color: theme.colors.TEXT_PRIMARY }]}>
                  {formattedDate}
                </Text>
              </View>
            </View>

            <View style={stylesheet.infoRow}>
              <View style={[stylesheet.iconBox, { backgroundColor: theme.colors.G + '15' }]}>
                <Feather name="clock" size={20} color={theme.colors.G} />
              </View>
              <View style={stylesheet.infoTextContainer}>
                <Text style={[stylesheet.infoLabel, { color: theme.colors.LABEL }]}>Time</Text>
                <Text style={[stylesheet.infoValue, { color: theme.colors.TEXT_PRIMARY }]}>
                  {formattedTime}
                </Text>
              </View>
            </View>

            <View style={stylesheet.infoRow}>
              <View style={[stylesheet.iconBox, { backgroundColor: theme.colors.G + '15' }]}>
                <Feather
                  name={event.location_online ? 'video' : 'map-pin'}
                  size={20}
                  color={theme.colors.G}
                />
              </View>
              <View style={stylesheet.infoTextContainer}>
                <Text style={[stylesheet.infoLabel, { color: theme.colors.LABEL }]}>
                  {event.location_online ? 'Platform' : 'Location'}
                </Text>
                <Text
                  style={[stylesheet.infoValue, { color: theme.colors.TEXT_PRIMARY }]}
                  numberOfLines={2}
                >
                  {event.location_online
                    ? 'Online Event'
                    : event.location_address ||
                      [event.ward, event.lga, event.state].filter(Boolean).join(', ') ||
                      'TBA'}
                </Text>
              </View>
            </View>

            <View style={stylesheet.infoRow}>
              <View style={[stylesheet.iconBox, { backgroundColor: theme.colors.G + '15' }]}>
                <Feather name="users" size={20} color={theme.colors.G} />
              </View>
              <View style={stylesheet.infoTextContainer}>
                <Text style={[stylesheet.infoLabel, { color: theme.colors.LABEL }]}>Attendees</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  <AttendeeAvatars
                    attendees={event.attendees as any}
                    totalCount={event.attendee_count}
                    size={22}
                    showIcon={false}
                    showCountBadge={false}
                  />
                  <Text style={[stylesheet.infoValue, { color: theme.colors.TEXT_PRIMARY }]}>
                    {event.attendee_count || 0} attending
                  </Text>
                </View>
              </View>
            </View>

            {!event.location_online && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: theme.colors.G,
                  marginTop: 0,
                  minHeight: 48,
                  width: '100%',
                }}
                accessibilityRole="button"
                accessibilityLabel="Get directions to this event"
                onPress={getDirections}
                activeOpacity={0.8}
              >
                <Feather name="navigation" size={18} color="#000" style={{ marginRight: 8 }} />
                <Text
                  style={{ fontFamily: 'Outfit', fontWeight: '800', fontSize: 14, color: '#000' }}
                >
                  Get Directions
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ABOUT SECTION */}
          <View
            style={[
              stylesheet.premiumCard,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <View style={stylesheet.aboutHeader}>
              <Text style={[stylesheet.sectionTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                About this event
              </Text>
            </View>
            <Text
              style={[stylesheet.description, { color: theme.colors.LABEL }]}
              numberOfLines={aboutExpanded ? undefined : 4}
            >
              {event.description || 'No description has been added.'}
            </Text>
            {event.description && event.description.length > 150 && (
              <TouchableOpacity
                onPress={() => setAboutExpanded(!aboutExpanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aboutExpanded }}
                style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[stylesheet.readMoreText, { color: theme.colors.G }]}>
                  {aboutExpanded ? 'Read Less' : 'Read More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ORGANIZER CARD */}
          <TouchableOpacity
            style={[
              stylesheet.premiumCard,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
              stylesheet.organizerCard,
            ]}
            onPress={() => {
              if (event.organizer_id) router.push(`/profile/${event.organizer_id}` as any);
            }}
            activeOpacity={0.8}
          >
            <View style={stylesheet.organizerRow}>
              <View style={[stylesheet.avatar, { backgroundColor: theme.colors.G }]}>
                {event.organizer?.avatar_url ? (
                  <Image
                    source={{ uri: event.organizer.avatar_url }}
                    style={stylesheet.avatarImage}
                  />
                ) : (
                  <Text style={stylesheet.avatarText}>
                    {event.organizer?.name ? event.organizer.name.charAt(0).toUpperCase() : 'O'}
                  </Text>
                )}
              </View>
              <View style={[stylesheet.organizerInfo, { marginRight: 8 }]}>
                <Text style={[stylesheet.organizerLabel, { color: theme.colors.LABEL }]}>
                  Organizer
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={[
                      stylesheet.sellerName,
                      { color: theme.colors.TEXT_PRIMARY, flexShrink: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {event.organizer?.name || 'Unknown Organizer'}
                  </Text>
                  {(event.organizer as any)?.phone_verified && (
                    <View style={{ marginLeft: 4, flexShrink: 0 }}>
                      <VerifiedBadge size={16} />
                    </View>
                  )}
                </View>
              </View>
              {!isOwner && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    width: '100%',
                    marginTop: 12,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      stylesheet.followBtn,
                      {
                        backgroundColor: theme.colors.SURFACE,
                        width: 44,
                        paddingHorizontal: 0,
                        justifyContent: 'center',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Message the organizer"
                    onPress={async (e) => {
                      e.stopPropagation();
                      if (!user || !event.organizer_id) return;
                      try {
                        const { data: convs } = await supabase
                          .from('conversations')
                          .select('id, type, participant_ids, item_id')
                          .eq('item_id', event.id)
                          .order('created_at', { ascending: true });
                        const existing = convs?.find(
                          (c) =>
                            c.type === 'event' &&
                            c.item_id === event.id &&
                            c.participant_ids?.includes(user.id) &&
                            c.participant_ids?.includes(event.organizer_id)
                        );
                        if (existing?.id) {
                          router.push(`/chat/${existing.id}`);
                        } else {
                          const query = `type=event&participant_id=${encodeURIComponent(event.organizer_id)}&item_id=${encodeURIComponent(event.id)}&item_title=${encodeURIComponent(event.title || 'Event')}&item_image=${encodeURIComponent(event.cover_image_url || '')}`;
                          router.push(`/chat/new?${query}`);
                        }
                      } catch (err) {
                        console.error('Error starting chat', err);
                      }
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={theme.colors.LABEL} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      stylesheet.followBtn,
                      {
                        backgroundColor: isFollowingOrganizer
                          ? theme.colors.SURFACE
                          : theme.colors.G,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFollowingOrganizer ? 'Unfollow organizer' : 'Follow organizer'
                    }
                    accessibilityState={{ selected: isFollowingOrganizer }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleFollow();
                    }}
                  >
                    <Text
                      style={[
                        stylesheet.followBtnText,
                        {
                          color: isFollowingOrganizer ? theme.colors.TEXT_PRIMARY : '#102110',
                        },
                      ]}
                    >
                      {isFollowingOrganizer ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {isOwner && <Feather name="chevron-right" size={20} color={theme.colors.LABEL} />}
            </View>
          </TouchableOpacity>

          {/* MAP PREVIEW */}
          {!event.location_online && event.lat && event.lng && (
            <TouchableOpacity
              style={[
                stylesheet.premiumCard,
                {
                  backgroundColor: theme.colors.SURFACE,
                  borderColor: theme.colors.GLASS_BORDER,
                  padding: 0,
                  overflow: 'hidden',
                },
              ]}
              onPress={getDirections}
              activeOpacity={0.9}
            >
              <MapView
                style={{ height: 160, width: '100%' }}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: event.lat,
                  longitude: event.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                userInterfaceStyle={false ? 'dark' : 'light'}
                customMapStyle={Platform.OS === 'android' ? (false ? DARK_STYLE : []) : undefined}
              >
                <Marker coordinate={{ latitude: event.lat, longitude: event.lng }}>
                  <View style={[stylesheet.mapMarker, { backgroundColor: theme.colors.G }]}>
                    <Feather name="map-pin" size={16} color={theme.colors.TEXT_PRIMARY} />
                  </View>
                </Marker>
              </MapView>
            </TouchableOpacity>
          )}

          {/* TICKETS SECTION */}
          <Text
            onLayout={(e) => {
              ticketSectionY.current = e.nativeEvent.layout.y;
            }}
            style={[
              stylesheet.sectionTitle,
              { color: theme.colors.TEXT_PRIMARY, marginTop: 12, marginBottom: 8 },
            ]}
          >
            Find your ticket
          </Text>
          <Text style={[eventUI.subtitle, { marginBottom: 18 }]}>
            Choose the experience that’s right for you.
          </Text>
          {event.ticket_tiers?.filter((t) => t.is_visible).length ? (
            event.ticket_tiers
              .filter((t) => t.is_visible)
              .map((tier) => {
                const remaining =
                  tier.capacity !== null ? Math.max(0, tier.capacity - tier.sold) : null;
                const isLimited =
                  remaining !== null &&
                  remaining > 0 &&
                  tier.capacity !== null &&
                  remaining <= tier.capacity * 0.4;
                return (
                  <TouchableOpacity
                    key={tier.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${tier.name}, ${tier.price === 0 ? 'free entry' : formatPrice(tier.price)}${tier.is_sold_out ? ', sold out' : ''}`}
                    accessibilityState={{ disabled: !!(tier.is_sold_out || isExpired || isOwner) }}
                    style={[
                      stylesheet.tierCard,
                      {
                        backgroundColor: theme.colors.SURFACE,
                        borderColor: tier.price === 0 ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                    disabled={tier.is_sold_out || isExpired || isOwner}
                    onPress={() => setSelectedTier(tier)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[stylesheet.tierIconBox, { backgroundColor: theme.colors.SURFACE }]}
                    >
                      <Feather name="tag" size={24} color={theme.colors.LABEL} />
                    </View>
                    <View style={stylesheet.tierInfo}>
                      <Text style={[stylesheet.tierName, { color: theme.colors.TEXT_PRIMARY }]}>
                        {tier.name}
                      </Text>
                      {tier.description && (
                        <Text
                          style={[stylesheet.tierDesc, { color: theme.colors.LABEL }]}
                          numberOfLines={2}
                        >
                          {tier.description}
                        </Text>
                      )}
                      {isLimited && (
                        <Text
                          style={{
                            color: '#F59E0B',
                            fontSize: 11,
                            fontWeight: '700',
                            marginTop: 3,
                          }}
                        >
                          {remaining} tickets left
                        </Text>
                      )}
                      <Text
                        style={[
                          stylesheet.tierPrice,
                          { color: tier.price === 0 ? theme.colors.G : theme.colors.TEXT_PRIMARY },
                        ]}
                      >
                        {tier.price === 0 ? 'FREE' : formatPrice(tier.price)}
                      </Text>
                    </View>
                    <View style={stylesheet.tierStatus}>
                      {isExpired ? (
                        <View style={[stylesheet.tierBadge, { backgroundColor: '#6B728020' }]}>
                          <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: 'bold' }}>
                            Ended
                          </Text>
                        </View>
                      ) : tier.is_sold_out ? (
                        <View style={[stylesheet.tierBadge, { backgroundColor: '#EF444420' }]}>
                          <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>
                            Sold Out
                          </Text>
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={20} color={theme.colors.LABEL} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
          ) : (
            <View
              style={[
                stylesheet.premiumCard,
                {
                  backgroundColor: theme.colors.SURFACE,
                  borderColor: theme.colors.GLASS_BORDER,
                  alignItems: 'center',
                  paddingVertical: 32,
                },
              ]}
            >
              <Feather
                name="tag"
                size={48}
                color={theme.colors.MUTED}
                style={{ marginBottom: 12 }}
              />
              <Text style={{ color: theme.colors.LABEL, fontSize: 16 }}>No tickets available.</Text>
            </View>
          )}

          {/* RELATED EVENTS */}
          {relatedEvents.length > 0 && (
            <View style={stylesheet.relatedSection}>
              <Text
                style={[
                  stylesheet.sectionTitle,
                  { color: theme.colors.TEXT_PRIMARY, marginBottom: 16 },
                ]}
              >
                More Events Near You
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {relatedEvents.map((rel) => {
                  return (
                    <TouchableOpacity
                      key={rel.id}
                      style={[
                        stylesheet.relatedCard,
                        {
                          backgroundColor: theme.colors.SURFACE,
                          borderColor: theme.colors.GLASS_BORDER,
                        },
                      ]}
                      onPress={() => {
                        router.push(`/events/${rel.id}`);
                      }}
                    >
                      <Image
                        source={{ uri: rel.cover_image_url }}
                        style={stylesheet.relatedImg}
                        contentFit="cover"
                      />
                      <View style={stylesheet.relatedInfo}>
                        <Text
                          style={[stylesheet.relatedTitle, { color: theme.colors.TEXT_PRIMARY }]}
                          numberOfLines={1}
                        >
                          {rel.title}
                        </Text>
                        <Text
                          style={[stylesheet.relatedLoc, { color: theme.colors.LABEL }]}
                          numberOfLines={1}
                        >
                          {rel.location_online ? 'Online' : rel.location_address || 'TBA'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {isOwner && (
            <TouchableOpacity
              style={[stylesheet.deleteEventBtn, { backgroundColor: '#EF444420' }]}
              onPress={() => {
                Alert.alert(
                  'Delete Event',
                  'Are you sure you want to delete this event? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await supabase.from('events').delete().eq('id', event.id);
                          await supabase
                            .from('posts')
                            .delete()
                            .ilike('event_link', `%events/${event.id}%`);
                          router.back();
                        } catch (e) {
                          Alert.alert('Error', 'Failed to delete event.');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Feather name="trash-2" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>
                Delete Event
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.ScrollView>

      {/* FLOATING ACTION BAR */}
      <View
        style={[
          stylesheet.bottomActionBar,
          {
            backgroundColor: theme.colors.SURFACE,
            borderTopColor: theme.colors.GLASS_BORDER,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            stylesheet.bottomPrimaryBtn,
            {
              backgroundColor: isOwner
                ? theme.colors.DARK
                : !userHasTickets && (isExpired || allTicketsSoldOut || noTickets)
                  ? theme.colors.GLASS_BORDER
                  : theme.colors.G,
              borderWidth: isOwner ? 1 : 0,
              borderColor: isOwner ? theme.colors.GLASS_BORDER : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !isOwner && !userHasTickets && (isExpired || allTicketsSoldOut || noTickets),
          }}
          disabled={!isOwner && !userHasTickets && (isExpired || allTicketsSoldOut || noTickets)}
          onPress={() => {
            if (isOwner) router.push(`/events/${event.id}/manage` as any);
            else if (userHasTickets) router.push('/tickets' as any);
            else scrollToTickets();
          }}
        >
          <Text
            style={[
              stylesheet.bottomPrimaryText,
              {
                color: isOwner
                  ? theme.colors.TEXT_PRIMARY
                  : !userHasTickets && (isExpired || allTicketsSoldOut || noTickets)
                    ? theme.colors.MUTED
                    : '#102110',
              },
            ]}
          >
            {isOwner
              ? 'Manage Event'
              : userHasTickets
                ? 'View my tickets'
                : isExpired
                  ? 'Event ended'
                  : noTickets
                    ? 'Tickets not available'
                    : allTicketsSoldOut
                      ? 'Sold out'
                      : 'Choose tickets'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ticket Purchase Modal */}
      <Modal
        visible={!!selectedTier}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!purchasing) {
            setSelectedTier(null);
            setQuantity(1);
          }
        }}
      >
        <KeyboardAvoidingView
          style={stylesheet.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              stylesheet.modalContent,
              { backgroundColor: theme.colors.DARK, paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={stylesheet.modalHeader}>
              <Text style={[stylesheet.modalTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                Make it a plan
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close ticket details"
                disabled={purchasing}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  setSelectedTier(null);
                  setQuantity(1);
                }}
              >
                <Ionicons name="close" size={24} color={theme.colors.LABEL} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={stylesheet.modalForm}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {selectedTier && (
                <View
                  style={[stylesheet.modalTierSummary, { backgroundColor: theme.colors.SURFACE }]}
                >
                  <View>
                    <Text style={[stylesheet.modalTierName, { color: theme.colors.TEXT_PRIMARY }]}>
                      {selectedTier.name}
                    </Text>
                    <Text style={[stylesheet.modalTierPrice, { color: theme.colors.G }]}>
                      {selectedTier.price === 0
                        ? 'FREE'
                        : formatPrice(selectedTier.price * quantity)}
                    </Text>
                  </View>
                  <View style={stylesheet.quantityContainer}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Remove one ticket"
                      accessibilityState={{ disabled: quantity <= 1 || purchasing }}
                      disabled={quantity <= 1 || purchasing}
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={[
                        stylesheet.quantityBtn,
                        { backgroundColor: theme.colors.GLASS_BORDER },
                      ]}
                    >
                      <Ionicons name="remove" size={20} color={theme.colors.TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <Text style={[stylesheet.quantityText, { color: theme.colors.TEXT_PRIMARY }]}>
                      {quantity}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Add one ticket"
                      accessibilityState={{ disabled: quantity >= 5 || purchasing }}
                      disabled={quantity >= 5 || purchasing}
                      onPress={() => setQuantity((q) => Math.min(5, q + 1))}
                      style={[
                        stylesheet.quantityBtn,
                        { backgroundColor: theme.colors.GLASS_BORDER },
                      ]}
                    >
                      <Ionicons name="add" size={20} color={theme.colors.TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={[stylesheet.inputLabel, { color: theme.colors.TEXT_PRIMARY }]}>
                Name *
              </Text>
              <TextInput
                style={[
                  stylesheet.input,
                  { backgroundColor: theme.colors.SURFACE, color: theme.colors.TEXT_PRIMARY },
                ]}
                value={attendeeName}
                onChangeText={setAttendeeName}
                accessibilityLabel="Attendee name, required"
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.LABEL}
              />
              <Text style={[stylesheet.inputLabel, { color: theme.colors.TEXT_PRIMARY }]}>
                Email *
              </Text>
              <TextInput
                style={[
                  stylesheet.input,
                  { backgroundColor: theme.colors.SURFACE, color: theme.colors.TEXT_PRIMARY },
                ]}
                value={attendeeEmail}
                onChangeText={setAttendeeEmail}
                accessibilityLabel="Attendee email, required"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.LABEL}
              />
              <Text style={[stylesheet.inputLabel, { color: theme.colors.TEXT_PRIMARY }]}>
                Phone (Optional)
              </Text>
              <TextInput
                style={[
                  stylesheet.input,
                  { backgroundColor: theme.colors.SURFACE, color: theme.colors.TEXT_PRIMARY },
                ]}
                value={attendeePhone}
                onChangeText={setAttendeePhone}
                accessibilityLabel="Attendee phone number, optional"
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                placeholderTextColor={theme.colors.LABEL}
              />
            </ScrollView>

            <TouchableOpacity
              style={[
                stylesheet.purchaseBtn,
                { backgroundColor: purchasing ? theme.colors.GLASS_BORDER : theme.colors.G },
              ]}
              disabled={purchasing}
              onPress={handlePurchase}
            >
              {purchasing ? (
                <Text style={stylesheet.purchaseBtnText}>Processing...</Text>
              ) : (
                <Text style={stylesheet.purchaseBtnText}>
                  {selectedTier?.price === 0
                    ? 'Register Now'
                    : `Pay ${formatPrice((selectedTier?.price || 0) * quantity)}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {ticketCheckout && (
        <PaylukCheckout
          paymentToken={ticketCheckout.paymentToken}
          publicKey={process.env.EXPO_PUBLIC_PAYLUK_PUBLIC_KEY || ''}
          reference={ticketCheckout.transactionId}
          customerId={ticketCheckout.customerId}
          redirectUrl={`${WEB_APP_URL}/api/events/tickets/verify?tx_ref=${encodeURIComponent(ticketCheckout.txRef)}`}
          onSuccess={verifyTicketCheckout}
          onCancel={() => {
            setTicketCheckout(null);
            Alert.alert(
              'Checkout closed',
              'Check My Tickets if you completed payment. An unpaid reservation remains held until checkout is safely cancelled.'
            );
          }}
          onError={(message) => {
            setTicketCheckout(null);
            Alert.alert('Checkout unavailable', message);
          }}
        />
      )}

      {isGalleryVisible && imageUrls.length > 0 && (
        <ImageViewing
          images={imageUrls.map((uri: string) => ({ uri }))}
          imageIndex={currentImageIndex}
          visible={isGalleryVisible}
          onRequestClose={() => setIsGalleryVisible(false)}
          swipeToCloseEnabled={true}
          doubleTapToZoomEnabled={true}
        />
      )}

      {/* ── Ticket Success Overlay ─────────────────── */}
      {ticketSuccess && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              justifyContent: 'flex-end',
            },
            successOverlayStyle,
          ]}
        >
          <View style={stylesheet.successBackdrop} />
          <Animated.View
            style={[
              stylesheet.successSheet,
              { backgroundColor: theme.colors.DARK },
              successSheetStyle,
            ]}
          >
            <View style={stylesheet.successHandleBar} />
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <Ionicons name="checkmark-circle" size={100} color="#82DB7E" />
            </View>
            <Animated.View
              style={[
                { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
                successContentStyle,
              ]}
            >
              <Text style={[stylesheet.successTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                You're In! 🎟️
              </Text>
              <Text style={[stylesheet.successTier, { color: theme.colors.G }]}>
                {successTierName}
              </Text>
              <Text style={[stylesheet.successBody, { color: theme.colors.LABEL }]}>
                Your ticket has been confirmed. Check the Tickets tab to view it.
              </Text>
              <TouchableOpacity
                style={[stylesheet.successBtn, { backgroundColor: theme.colors.G }]}
                onPress={() => {
                  dismissTicketSuccess();
                  router.push('/tickets' as any);
                }}
                activeOpacity={0.85}
              >
                <Text style={stylesheet.successBtnText}>View My Ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={stylesheet.successSecondary} onPress={dismissTicketSuccess}>
                <Text style={[stylesheet.successSecondaryText, { color: theme.colors.LABEL }]}>
                  Back to Event
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={{ height: 24 }} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme, rt) => ({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 18, marginBottom: 20 },
  backBtnWrapper: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backBtnText: { fontWeight: 'bold' },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerRightActions: { flexDirection: 'row' },
  scrollContent: { flex: 1 },

  heroContainer: { position: 'relative', width: rt.screen.width, height: rt.screen.width * 0.9 },
  mainImage: {
    width: rt.screen.width,
    height: rt.screen.width * 0.9,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  placeholderImage: {
    width: rt.screen.width,
    height: rt.screen.width * 0.9,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  galleryBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  galleryBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },

  infoSection: { padding: 20, paddingTop: 24 },
  titleRow: {
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 26,
  },
  title: { fontFamily: 'Outfit-Bold', fontSize: 34, lineHeight: 40 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold' },

  premiumCard: { padding: 18, borderRadius: 22, borderWidth: 1, marginBottom: 20 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  infoRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontFamily: 'Inter-Regular', fontSize: 12, marginBottom: 4 },
  infoValue: { fontFamily: 'Inter-SemiBold', fontSize: 15, lineHeight: 22, flexShrink: 1 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  directionsTxt: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: theme.colors.TEXT_PRIMARY,
  },

  aboutHeader: { marginBottom: 12 },
  sectionTitle: { fontFamily: 'Outfit-Bold', fontSize: 23, lineHeight: 29 },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 24 },
  readMoreText: { fontSize: 15, fontWeight: 'bold' },

  organizerCard: { padding: 16 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: theme.colors.TEXT_PRIMARY, fontSize: 22, fontWeight: 'bold' },
  organizerInfo: { flex: 1, minWidth: 120 },
  organizerLabel: { fontSize: 13, marginBottom: 2 },
  sellerName: { fontSize: 17, fontWeight: 'bold' },
  followBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginLeft: 12,
  },
  followBtnText: { fontWeight: 'bold', fontSize: 14 },

  mapMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },

  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  tierIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tierInfo: { flex: 1, minWidth: 0, marginRight: 10 },
  tierName: { fontFamily: 'Outfit-Bold', fontSize: 20, lineHeight: 26, marginBottom: 4 },
  tierDesc: { fontSize: 14, marginBottom: 8 },
  tierPrice: { fontSize: 16, fontWeight: 'bold' },
  tierStatus: { maxWidth: 70, alignItems: 'center', justifyContent: 'center' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },

  relatedSection: { marginTop: 16, marginBottom: 24 },
  relatedCard: {
    width: 220,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 16,
    overflow: 'hidden',
  },
  relatedImg: { width: '100%', height: 120 },
  relatedInfo: { padding: 12 },
  relatedTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  relatedLoc: { fontSize: 13 },

  deleteEventBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
  },

  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  bottomShareBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomPrimaryBtn: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPrimaryText: { fontFamily: 'Outfit-Bold', fontSize: 17, textAlign: 'center' },

  // Modal styles preserved
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { flex: 1, fontFamily: 'Outfit-Bold', fontSize: 25, lineHeight: 31 },
  modalTierSummary: {
    padding: 16,
    borderRadius: 16,
    gap: 16,
    marginBottom: 20,
  },
  modalTierName: { fontSize: 16, fontWeight: '600' },
  modalTierPrice: { fontSize: 18, fontWeight: 'bold' },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  quantityBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16 },
  modalForm: { flexShrink: 1, minHeight: 0, marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { padding: 16, borderRadius: 16, marginBottom: 16, fontSize: 16 },
  purchaseBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
  purchaseBtnText: { color: '#102110', fontSize: 16, fontWeight: 'bold' },

  // Success overlay
  successBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  successSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    alignItems: 'center',
  },
  successHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  successTier: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  successBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    maxWidth: 270,
  },
  successBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successBtnText: { color: '#102110', fontSize: 16, fontWeight: '800' },
  successSecondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  successSecondaryText: { fontSize: 14, fontWeight: '600' },
}));
