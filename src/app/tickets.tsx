import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../lib/supabase/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { useNotificationRouteAcknowledgement } from '../hooks/notifications/use-notification-route-ack';
import { getMyTickets } from '../lib/events/event-service';
import { Ticket } from '../types/events';
import { getEventTicketPresentation } from '../lib/events/event-ticket-presentation';

export default function TicketsScreen() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const requestEpoch = useRef(0);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  useNotificationRouteAcknowledgement(!loading);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ticketTranslateY = useSharedValue(200);

  useEffect(() => {
    if (selectedTicket) {
      ticketTranslateY.value = withDelay(100, withSpring(0, { damping: 14, stiffness: 100 }));
    } else {
      ticketTranslateY.value = 200;
    }
  }, [selectedTicket, ticketTranslateY]);

  const animatedTicketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ticketTranslateY.value }],
  }));

  const fetchTickets = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    if (!userId) {
      setTickets([]);
      setSelectedTicket(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(false);
    try {
      const data = await getMyTickets(userId);
      if (epoch !== requestEpoch.current) return;
      setTickets(data);
      setSelectedTicket((current) =>
        current ? data.find((ticket) => ticket.id === current.id) || null : null
      );
    } catch {
      if (epoch === requestEpoch.current) setLoadError(true);
    } finally {
      if (epoch === requestEpoch.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    setTickets([]);
    setSelectedTicket(null);
    setLoading(true);
    void fetchTickets();
    return () => {
      requestEpoch.current += 1;
    };
  }, [fetchTickets]);
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        if (AppState.currentState === 'active') void fetchTickets();
      };
      refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      const timer = setInterval(refresh, 30000);
      return () => {
        subscription.remove();
        clearInterval(timer);
        requestEpoch.current += 1;
      };
    }, [fetchTickets])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  const displayedTickets = tickets.filter(
    (t) =>
      !t.is_archived &&
      (activeTab === 'active'
        ? !getEventTicketPresentation(t).isPast
        : getEventTicketPresentation(t).isPast)
  );

  const handleDeleteTicket = (ticketId: string) => {
    Alert.alert(
      'Delete Ticket',
      'Remove this ticket from your history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(ticketId);
            try {
              const { error } = await supabase
                .from('tickets')
                .update({ is_archived: true })
                .eq('id', ticketId)
                .eq('buyer_id', user!.id);
              if (error) throw error;
              setTickets((prev) =>
                prev.map((t) => (t.id === ticketId ? { ...t, is_archived: true } : t))
              );
            } catch (e) {
              console.error('Delete ticket error:', e);
              Alert.alert('Error', 'Could not delete ticket.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderTicket = ({ item }: { item: Ticket }) => {
    const event = item.event;
    const imageUrl = event?.cover_image_url;
    const formattedDate = event?.start_time
      ? new Date(event.start_time).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Date TBD';

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 20,
          padding: 14,
          borderWidth: 1,
          borderColor: theme.colors.GLASS_BORDER,
          backgroundColor: theme.colors.SURFACE,
          marginBottom: 12,
        }}
        onPress={() => setSelectedTicket(item)}
        activeOpacity={0.8}
      >
        {/* Image */}
        <View
          style={{ width: 60, height: 60, borderRadius: 16, overflow: 'hidden', marginRight: 14 }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.colors.G + '15',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Feather name="calendar" size={24} color={theme.colors.G} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Outfit-Bold',
              fontSize: 18,
              color: theme.colors.TEXT_PRIMARY,
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {event?.title || 'Event'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="calendar" size={12} color={theme.colors.MUTED} />
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED }}>
              {formattedDate}
            </Text>
          </View>
          {item.is_test_payment && (
            <Text style={{ color: theme.colors.MUTED, fontSize: 11, marginBottom: 4 }}>
              Sandbox · no real payment
            </Text>
          )}
          {(() => {
            const statusInfo = getEventTicketPresentation(item);
            return (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: statusInfo.isValid
                    ? theme.colors.G + '15'
                    : 'rgba(255,255,255,0.06)',
                  alignSelf: 'flex-start',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: '700',
                    fontSize: 11,
                    color: statusInfo.isValid ? theme.colors.G : theme.colors.MUTED,
                  }}
                >
                  {statusInfo.label}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Tear line */}
        <View style={stylesheet.tearLine}>
          <View style={[stylesheet.tearCircleTop, { backgroundColor: theme.colors.DARK }]} />
          <View style={[stylesheet.tearDashes, { borderLeftColor: theme.colors.GLASS_BORDER }]} />
          <View style={[stylesheet.tearCircleBottom, { backgroundColor: theme.colors.DARK }]} />
        </View>

        {/* QR hint / Delete for past */}
        {activeTab === 'past' ? (
          <TouchableOpacity
            style={stylesheet.qrSection}
            onPress={(press) => {
              press.stopPropagation();
              handleDeleteTicket(item.id);
            }}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? (
              <ActivityIndicator size="small" color="#E53935" />
            ) : (
              <Feather name="trash-2" size={22} color="#E53935" />
            )}
            <Text style={[stylesheet.tapText, { color: '#E53935' }]}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={stylesheet.qrSection}>
            <Feather name="maximize" size={40} color={theme.colors.G} />
            <Text style={[stylesheet.tapText, { color: theme.colors.MUTED }]}>Tap to view</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const selectedInfo = selectedTicket ? getEventTicketPresentation(selectedTicket) : null;

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <View
        style={[
          stylesheet.header,
          { backgroundColor: theme.colors.DARK, borderBottomColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <View style={stylesheet.headerTop}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={stylesheet.backButton}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={stylesheet.eyebrow}>YOUR PLANS</Text>
        </View>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Tickets, ready to go.
        </Text>
        <Text style={stylesheet.headerHint}>
          Keep your entry passes close. Open a ticket for its entry code or refund status.
        </Text>
      </View>

      <View style={[stylesheet.tabRow, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity
          style={[stylesheet.tab, activeTab === 'active' && { borderBottomColor: theme.colors.G }]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[
              stylesheet.tabText,
              { color: activeTab === 'active' ? theme.colors.G : theme.colors.MUTED },
            ]}
          >
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesheet.tab, activeTab === 'past' && { borderBottomColor: theme.colors.G }]}
          onPress={() => setActiveTab('past')}
        >
          <Text
            style={[
              stylesheet.tabText,
              { color: activeTab === 'past' ? theme.colors.G : theme.colors.MUTED },
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {loadError && (
        <TouchableOpacity accessibilityRole="button" onPress={fetchTickets} style={{ padding: 20 }}>
          <Text style={stylesheet.headerHint}>Could not update your tickets. Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {loading ? (
        <View style={stylesheet.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <FlatList
          data={displayedTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={stylesheet.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={stylesheet.emptyContainer}>
              <Feather name="tag" size={72} color={theme.colors.GLASS_BORDER} />
              <Text style={[stylesheet.emptyTitle, { color: theme.colors.TEXT_PRIMARY }]}>
                {activeTab === 'past' ? 'No past tickets' : 'Your next plan awaits'}
              </Text>
              <Text style={[stylesheet.emptySubtitle, { color: theme.colors.MUTED }]}>
                {activeTab === 'past'
                  ? 'Used and past tickets will appear here.'
                  : 'Find an event you love. Your tickets will be waiting here.'}
              </Text>
              <TouchableOpacity
                style={[stylesheet.browseButton, { backgroundColor: theme.colors.G }]}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/catalog', params: { tab: 'Events' } } as any)
                }
              >
                <Text style={stylesheet.browseButtonText}>Browse Events</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* QR Ticket Modal */}
      <Modal
        visible={!!selectedTicket}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <SafeAreaView style={[stylesheet.modalContainer, { backgroundColor: theme.colors.DARK }]}>
          <View style={[stylesheet.modalHeader, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
            <TouchableOpacity onPress={() => setSelectedTicket(null)} style={stylesheet.modalClose}>
              <Feather name="x" size={26} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={[stylesheet.modalTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              Your Ticket
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Refresh ticket status"
              disabled={refreshing}
              onPress={async () => {
                setRefreshing(true);
                await fetchTickets();
              }}
              style={stylesheet.modalClose}
            >
              <Feather name="refresh-cw" size={22} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          {selectedTicket && (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.G}
                />
              }
            >
              <Animated.View style={[stylesheet.modalContent, animatedTicketStyle]}>
                {/* Event card */}
                <View
                  style={[stylesheet.modalEventCard, { backgroundColor: theme.colors.SURFACE }]}
                >
                  {selectedTicket.event?.cover_image_url && (
                    <Image
                      source={{ uri: selectedTicket.event?.cover_image_url }}
                      style={stylesheet.modalEventImage}
                      contentFit="cover"
                    />
                  )}
                  <View style={stylesheet.modalEventInfo}>
                    <Text
                      style={[stylesheet.modalEventTitle, { color: theme.colors.TEXT_PRIMARY }]}
                    >
                      {selectedTicket.event?.title || 'Event'}
                    </Text>
                    <Text style={[stylesheet.modalEventDate, { color: theme.colors.LABEL }]}>
                      {selectedTicket.event?.start_time
                        ? new Date(selectedTicket.event.start_time).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Date TBD'}
                    </Text>
                  </View>
                </View>

                {/* QR Code */}
                {selectedInfo?.isValid && !loadError ? (
                  <View style={[stylesheet.qrContainer, { backgroundColor: '#FFFFFF' }]}>
                    <QRCode
                      value={selectedTicket.id}
                      size={220}
                      color="#102110"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                ) : (
                  <View style={stylesheet.qrContainer}>
                    <Feather name="info" size={48} color={theme.colors.MUTED} />
                  </View>
                )}

                {/* Ticket token */}
                <Text style={[stylesheet.tokenLabel, { color: theme.colors.MUTED }]}>
                  TICKET ID
                </Text>
                <Text style={[stylesheet.tokenValue, { color: theme.colors.TEXT_PRIMARY }]}>
                  {selectedTicket.id.slice(0, 16).toUpperCase()}
                </Text>

                <View
                  style={[
                    stylesheet.modalStatusBadge,
                    selectedInfo?.isValid
                      ? stylesheet.activeBadge
                      : [stylesheet.usedBadge, { backgroundColor: theme.colors.SURFACE }],
                  ]}
                >
                  <Text
                    style={[
                      stylesheet.modalStatusText,
                      {
                        color: selectedInfo?.isValid ? theme.colors.G : theme.colors.MUTED,
                      },
                    ]}
                  >
                    {selectedInfo?.isValid ? 'Active ticket' : selectedInfo?.label}
                  </Text>
                </View>

                <Text style={[stylesheet.scanInstructions, { color: theme.colors.MUTED }]}>
                  {loadError
                    ? 'Could not update this ticket. Refresh its status before entry.'
                    : selectedInfo?.message}
                </Text>
                {selectedTicket.is_test_payment && (
                  <Text style={stylesheet.scanInstructions}>Sandbox · no real payment</Text>
                )}
                <Text style={[stylesheet.scanInstructions, { color: theme.colors.MUTED }]}>
                  For ticket questions or a refund request, contact the organiser from the event
                  page.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedTicket(null);
                    router.push(`/events/${selectedTicket.event_id}` as any);
                  }}
                  style={[stylesheet.browseButton, { backgroundColor: theme.colors.G }]}
                >
                  <Text style={stylesheet.browseButtonText}>View event and contact organiser</Text>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1.8, color: theme.colors.G },
  headerHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.MUTED,
    marginTop: 8,
  },
  headerTitle: { fontSize: 30, lineHeight: 36, fontFamily: 'Outfit-Bold' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  tab: {
    marginRight: 24,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 15, fontFamily: 'Outfit-SemiBold' },
  listContent: { padding: 20, paddingBottom: 100 },

  ticketCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  ticketAccent: { width: 6 },
  ticketImageWrapper: { padding: 12 },
  ticketImage: { width: 72, height: 72, borderRadius: 8 },
  ticketImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  ticketInfo: { flex: 1, paddingVertical: 12, paddingRight: 8 },
  ticketTitle: { fontSize: 15, fontFamily: 'Outfit-Bold', marginBottom: 6 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  ticketMetaText: { fontSize: 12, marginLeft: 4, fontFamily: 'Inter-Regular' },
  eventLocation: { fontSize: 12, marginLeft: 4, flex: 1, fontFamily: 'Inter-Regular' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  activeBadge: { backgroundColor: 'rgba(56,142,60,0.12)' },
  usedBadge: {},
  statusBadgeText: { fontSize: 10, fontFamily: 'Outfit-Bold' },

  tearLine: { width: 20, alignItems: 'center', justifyContent: 'center' },
  tearCircleTop: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  tearCircleBottom: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  tearDashes: { flex: 1, borderLeftWidth: 1.5, borderStyle: 'dashed' },

  qrSection: { width: 58, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 4 },
  tapText: { fontSize: 9, fontFamily: 'Outfit-SemiBold' },

  emptyContainer: { flex: 1, paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', marginTop: 20, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, fontFamily: 'Inter-Regular', textAlign: 'center', lineHeight: 22 },
  browseButton: {
    marginTop: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  browseButtonText: { color: '#102110', fontSize: 16, fontFamily: 'Outfit-Bold' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalClose: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Outfit-Bold' },
  modalContent: { flexGrow: 1, alignItems: 'center', padding: 24 },
  modalEventCard: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 32,
    gap: 12,
  },
  modalEventImage: { width: 80, height: 80 },
  modalEventInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  modalEventTitle: { fontSize: 15, fontFamily: 'Outfit-Bold', marginBottom: 4 },
  modalEventDate: { fontSize: 12, fontFamily: 'Inter-Regular' },
  qrContainer: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  tokenLabel: {
    fontSize: 11,
    fontFamily: 'Outfit-ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tokenValue: { fontSize: 14, fontFamily: 'Outfit-Bold', letterSpacing: 2, marginBottom: 20 },
  modalStatusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  modalStatusText: { fontSize: 14, fontFamily: 'Outfit-Bold' },
  scanInstructions: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
}));
