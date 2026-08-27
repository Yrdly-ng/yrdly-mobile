import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { getMyTickets } from '../lib/event-service';
import { Post } from '../types';
import { Ticket, Event } from '../types/events';
const getTicketStatusInfo = (ticket: Ticket) => {
  const isActiveOrConfirmed = ticket.status === 'PAID';

  if (!isActiveOrConfirmed) {
    return { isExpired: false, isValid: false, text: ticket.status.toUpperCase() };
  }

  const eventDate = ticket.event?.start_time ? new Date(ticket.event.start_time) : null;
  // Give a 24-hour buffer after the event date before expiring the ticket
  const isExpired = eventDate
    ? new Date().getTime() - eventDate.getTime() > 24 * 60 * 60 * 1000
    : false;

  if (isExpired) {
    return { isExpired: true, isValid: false, text: 'EXPIRED' };
  }

  return { isExpired: false, isValid: true, text: 'PAID' };
};

export default function TicketsScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [selectedTicket]);

  const animatedTicketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ticketTranslateY.value }],
  }));

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyTickets(user.id);
      setTickets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  const isTicketPast = (t: Ticket) => {
    const info = getTicketStatusInfo(t);
    return (
      info.isExpired || t.status === 'USED' || t.status === 'CANCELLED' || t.status === 'REFUNDED'
    );
  };

  const displayedTickets = tickets.filter(
    (t) => !t.is_archived && (activeTab === 'active' ? !isTicketPast(t) : isTicketPast(t))
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
              await supabase
                .from('tickets')
                .update({ is_archived: true })
                .eq('id', ticketId)
                .eq('buyer_id', user!.id);
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
              fontFamily: 'Outfit',
              fontWeight: '800',
              fontSize: 16,
              color: theme.colors.TEXT_PRIMARY,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {event?.title || 'Event'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="calendar" size={12} color={theme.colors.MUTED} />
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED }}>
              {formattedDate}
            </Text>
          </View>
          {(() => {
            const statusInfo = getTicketStatusInfo(item);
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
                  {statusInfo.text}
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
            onPress={() => handleDeleteTicket(item.id)}
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

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <View
        style={[
          stylesheet.header,
          { backgroundColor: theme.colors.DARK, borderBottomColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          My Tickets
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
            Active
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
            Past / Used
          </Text>
        </TouchableOpacity>
      </View>

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
                No Tickets Yet
              </Text>
              <Text style={[stylesheet.emptySubtitle, { color: theme.colors.MUTED }]}>
                Buy tickets to events to see them here.
              </Text>
              <TouchableOpacity
                style={[stylesheet.browseButton, { backgroundColor: theme.colors.G }]}
                onPress={() => router.push('/catalog')}
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
            <View style={{ width: 40 }} />
          </View>

          {selectedTicket && (
            <Animated.View style={[stylesheet.modalContent, animatedTicketStyle]}>
              {/* Event card */}
              <View style={[stylesheet.modalEventCard, { backgroundColor: theme.colors.SURFACE }]}>
                {selectedTicket.event?.cover_image_url && (
                  <Image
                    source={{ uri: selectedTicket.event?.cover_image_url }}
                    style={stylesheet.modalEventImage}
                    contentFit="cover"
                  />
                )}
                <View style={stylesheet.modalEventInfo}>
                  <Text style={[stylesheet.modalEventTitle, { color: theme.colors.TEXT_PRIMARY }]}>
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
              <View style={[stylesheet.qrContainer, { backgroundColor: theme.colors.SURFACE }]}>
                <QRCode
                  value={selectedTicket.id}
                  size={220}
                  color={theme.colors.TEXT_PRIMARY}
                  backgroundColor={theme.colors.DARK}
                />
              </View>

              {/* Ticket token */}
              <Text style={[stylesheet.tokenLabel, { color: theme.colors.MUTED }]}>TICKET ID</Text>
              <Text style={[stylesheet.tokenValue, { color: theme.colors.TEXT_PRIMARY }]}>
                {selectedTicket.id.slice(0, 16).toUpperCase()}
              </Text>

              <View
                style={[
                  stylesheet.modalStatusBadge,
                  getTicketStatusInfo(selectedTicket).isValid
                    ? stylesheet.activeBadge
                    : [stylesheet.usedBadge, { backgroundColor: theme.colors.SURFACE }],
                ]}
              >
                <Text
                  style={[
                    stylesheet.modalStatusText,
                    {
                      color: getTicketStatusInfo(selectedTicket).isExpired
                        ? '#FFA000'
                        : theme.colors.G,
                    },
                  ]}
                >
                  {getTicketStatusInfo(selectedTicket).isValid
                    ? '✓ Valid Ticket'
                    : getTicketStatusInfo(selectedTicket).text}
                </Text>
              </View>

              <Text style={[stylesheet.scanInstructions, { color: theme.colors.MUTED }]}>
                Present this QR code to the event organizer for check-in
              </Text>
            </Animated.View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontFamily: 'Outfit-Bold' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  tab: {
    marginRight: 24,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 15, fontFamily: 'Outfit-SemiBold' },
  listContent: { padding: 16, paddingBottom: 100 },

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

  qrSection: { width: 80, justifyContent: 'center', alignItems: 'center', gap: 4 },
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
  browseButtonText: { color: theme.colors.TEXT_PRIMARY, fontSize: 16, fontFamily: 'Outfit-Bold' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalClose: { width: 40, justifyContent: 'center', alignItems: 'flex-start' },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Outfit-Bold' },
  modalContent: { flex: 1, alignItems: 'center', padding: 24 },
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
