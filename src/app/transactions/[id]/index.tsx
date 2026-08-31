import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { formatPrice } from '../../../lib/utils';
import { useAppTheme } from '../../../context/ThemeContext';
import { MARKETPLACE_CONSTANTS } from '../../../lib/constants';

import { api } from '../../../lib/api';

type EscrowStatus =
  'pending' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'disputed' | 'cancelled';

interface TxDetail {
  id: string;
  amount: number;
  commission: number;
  seller_amount: number;
  status: EscrowStatus;
  payment_provider: string | null;
  payluk_tx_ref: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  buyer_id: string;
  seller_id: string;
  item: { id: string; title: string; images: string[] | null; price: number } | null;
  buyer: { id: string; name: string; avatar_url: string | null } | null;
  seller: { id: string; name: string; avatar_url: string | null } | null;
}

const getStatusMeta = (status: EscrowStatus, isDarkMode: boolean, colors: any) => {
  const meta: Record<EscrowStatus, { label: string; color: string; bg: string; icon: string }> = {
    pending: {
      label: 'Awaiting Payment',
      color: colors.WARNING,
      bg: colors.SURFACE,
      icon: 'clock',
    },
    paid: {
      label: 'Paid — Awaiting Handover',
      color: colors.G,
      bg: isDarkMode ? colors.SURFACE : '#E3F2FD',
      icon: 'box',
    },
    shipped: {
      label: 'Item Sent / Handed Over',
      color: isDarkMode ? '#CE93D8' : '#6A1B9A',
      bg: isDarkMode ? '#311B92' : '#F3E5F5',
      icon: 'truck',
    },
    delivered: {
      label: 'Delivered',
      color: isDarkMode ? '#81C784' : '#2E7D32',
      bg: isDarkMode ? '#1B5E20' : '#E8F5E9',
      icon: 'check-circle',
    },
    completed: {
      label: 'Completed',
      color: isDarkMode ? '#81C784' : '#2E7D32',
      bg: isDarkMode ? '#1B5E20' : '#E8F5E9',
      icon: 'check-circle',
    },
    disputed: {
      label: 'Disputed',
      color: isDarkMode ? '#E57373' : '#B71C1C',
      bg: isDarkMode ? '#3E2723' : '#FFEBEE',
      icon: 'alert-circle',
    },
    cancelled: {
      label: 'Cancelled',
      color: isDarkMode ? '#E0E0E0' : '#757575',
      bg: isDarkMode ? '#424242' : '#F5F5F5',
      icon: 'x-circle',
    },
  };
  return meta[status];
};

const TIMELINE_STEPS: { status: EscrowStatus; label: string; tsKey: keyof TxDetail }[] = [
  { status: 'pending', label: 'Order created', tsKey: 'created_at' },
  { status: 'paid', label: 'Payment confirmed', tsKey: 'paid_at' },
  { status: 'shipped', label: 'Item sent / handed over', tsKey: 'shipped_at' },
  { status: 'completed', label: 'Receipt confirmed', tsKey: 'completed_at' },
];

const STATUS_ORDER: EscrowStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'completed'];

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TransactionDetailScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { isDarkMode } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [tx, setTx] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Animation values ──────────────────────────────────────────
  const bannerX = useSharedValue(-60);
  const bannerOp = useSharedValue(0);
  const card1Op = useSharedValue(0);
  const card1Y = useSharedValue(16);
  const card2Op = useSharedValue(0);
  const card2Y = useSharedValue(16);
  const card3Op = useSharedValue(0);
  const card3Y = useSharedValue(16);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOp.value,
    transform: [{ translateX: bannerX.value }],
  }));
  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Op.value,
    transform: [{ translateY: card1Y.value }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Op.value,
    transform: [{ translateY: card2Y.value }],
  }));
  const card3Style = useAnimatedStyle(() => ({
    opacity: card3Op.value,
    transform: [{ translateY: card3Y.value }],
  }));

  function runEntranceAnimation() {
    const ease = Easing.out(Easing.cubic);
    // Banner slides in from left
    bannerOp.value = withTiming(1, { duration: 350, easing: ease });
    bannerX.value = withSpring(0, { damping: 20, stiffness: 160 });
    // Cards stagger up
    card1Op.value = withDelay(120, withTiming(1, { duration: 350, easing: ease }));
    card1Y.value = withDelay(120, withSpring(0, { damping: 20, stiffness: 140 }));
    card2Op.value = withDelay(220, withTiming(1, { duration: 350, easing: ease }));
    card2Y.value = withDelay(220, withSpring(0, { damping: 20, stiffness: 140 }));
    card3Op.value = withDelay(320, withTiming(1, { duration: 350, easing: ease }));
    card3Y.value = withDelay(320, withSpring(0, { damping: 20, stiffness: 140 }));
  }

  const fetchTx = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select(
          `
          id, item_id, item_type, amount, commission, seller_amount, status,
          payment_provider, payluk_tx_ref,
          created_at, paid_at, shipped_at, delivered_at, completed_at,
          buyer_id, seller_id,
          post_item:posts(id, title, text, image_urls, image_url, price),
          catalog_item:catalog_items(id, title, images, price),
          buyer:users!escrow_transactions_buyer_id_fkey(id, name, avatar_url),
          seller:users!escrow_transactions_seller_id_fkey(id, name, avatar_url)
        `
        )
        .eq('id', id)
        .single();
      if (error) throw error;

      const postItem = Array.isArray(data.post_item) ? data.post_item[0] : data.post_item;
      const catalogItem = Array.isArray(data.catalog_item)
        ? data.catalog_item[0]
        : data.catalog_item;

      let itemObj: { id: string; title: string; images: string[] | null; price: number } | null =
        null;

      if (postItem) {
        const imgs = Array.isArray(postItem.image_urls)
          ? postItem.image_urls
          : postItem.image_url
            ? [postItem.image_url]
            : null;
        itemObj = {
          id: postItem.id,
          title: postItem.title || postItem.text || 'Item',
          images: imgs,
          price: postItem.price,
        };
      } else if (catalogItem) {
        const imgs = Array.isArray(catalogItem.images)
          ? catalogItem.images
          : typeof catalogItem.images === 'string'
            ? [catalogItem.images]
            : null;
        itemObj = {
          id: catalogItem.id,
          title: catalogItem.title || 'Item',
          images: imgs,
          price: catalogItem.price,
        };
      }

      // Fallback: If joined relationship returned null, fetch directly using item_id
      if (!itemObj && data.item_id) {
        // Try catalog_items first
        const { data: catData } = await supabase
          .from('catalog_items')
          .select('id, title, images, price')
          .eq('id', data.item_id)
          .maybeSingle();

        if (catData) {
          const imgs = Array.isArray(catData.images)
            ? catData.images
            : typeof catData.images === 'string'
              ? [catData.images]
              : null;
          itemObj = {
            id: catData.id,
            title: catData.title || 'Item',
            images: imgs,
            price: catData.price,
          };
        } else {
          // Try posts table
          const { data: pData } = await supabase
            .from('posts')
            .select('id, title, text, image_urls, image_url, price')
            .eq('id', data.item_id)
            .maybeSingle();

          if (pData) {
            const imgs = Array.isArray(pData.image_urls)
              ? pData.image_urls
              : pData.image_url
                ? [pData.image_url]
                : null;
            itemObj = {
              id: pData.id,
              title: pData.title || pData.text || 'Item',
              images: imgs,
              price: pData.price,
            };
          }
        }
      }

      const normalised = {
        ...data,
        item: itemObj,
        buyer: Array.isArray(data.buyer) ? (data.buyer[0] ?? null) : data.buyer,
        seller: Array.isArray(data.seller) ? (data.seller[0] ?? null) : data.seller,
      } as TxDetail;
      setTx(normalised);
      // Run entrance after data is ready
      setTimeout(runEntranceAnimation, 80);
    } catch {
      Alert.alert('Error', 'Transaction not found.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  const isBuyer = tx?.buyer_id === user?.id;
  const isSeller = tx?.seller_id === user?.id;
  const counterparty = isBuyer ? tx?.seller : tx?.buyer;

  // ── Seller: mark item as sent ───────────────────────────────
  const handleMarkSent = async () => {
    if (!tx || !user) return;
    Alert.alert(
      'Mark as Sent?',
      "Confirm that you've handed over or dispatched the item to the buyer.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('escrow_transactions')
                .update({
                  status: 'shipped',
                  shipped_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', tx.id)
                .eq('seller_id', user.id);
              if (error) throw error;
              await fetchTx();
              Alert.alert('Done!', "The buyer has been notified that you've sent the item.");
            } catch {
              Alert.alert('Error', 'Could not update the transaction. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Buyer: confirm receipt → releases funds ─────────────────
  const handleConfirmReceipt = async () => {
    if (!tx || !user) return;
    Alert.alert(
      'Confirm Receipt?',
      `This will release ${formatPrice(tx.seller_amount)} to the seller. Only confirm if you have received the item.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Receipt',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (tx.payment_provider === 'payluk') {
                // Payluk path: call backend which will call Payluk's confirm-payment API
                await api.post('/api/payluk/confirm-delivery', { transactionId: tx.id });
              } else {
                // Paystack / legacy path: direct DB update (existing behaviour)
                const { error } = await supabase
                  .from('escrow_transactions')
                  .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', tx.id)
                  .eq('buyer_id', user.id);
                if (error) throw error;
              }
              await fetchTx();
              Alert.alert('🎉 Done!', 'Funds have been released to the seller. Thank you!');
            } catch (e: any) {
              const msg: string = e?.message ?? '';
              if (msg === 'DELIVERY_RECORDED_FAILED') {
                Alert.alert('Action Completed', 'payment processed, please contact support');
              } else {
                Alert.alert('Error', msg || 'Could not confirm receipt. Please try again.');
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Seller: claim funds after delivery window ───────────────
  const handleClaimFunds = async () => {
    if (!tx || !user) return;
    Alert.alert(
      'Claim Funds?',
      "Request release of your funds. This is only allowed after the buyer's confirmation window has elapsed.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim Funds',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (tx.payment_provider === 'payluk') {
                await api.post('/api/payluk/claim-funds', { transactionId: tx.id });
              } else {
                await api.post(`/api/transactions/${tx.id}/claim`, {});
              }
              await fetchTx();
              Alert.alert('✅ Claimed!', 'Your funds have been released to your wallet.');
            } catch (e: any) {
              const msg: string = e?.message ?? '';
              if (msg === 'CLAIM_RECORDED_FAILED') {
                Alert.alert('Action Completed', 'payment processed, please contact support');
              } else {
                Alert.alert(
                  'Cannot Claim Yet',
                  msg ||
                    "Funds cannot be claimed yet. The buyer's confirmation window may not have elapsed."
                );
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !tx) {
    return (
      <SafeAreaView style={stylesheet.center}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  const meta = getStatusMeta(tx.status, isDarkMode, theme.colors);
  const currentStepIndex = STATUS_ORDER.indexOf(tx.status);
  const rawThumb = tx.item?.images;
  const thumb =
    Array.isArray(rawThumb) && rawThumb.length > 0 && typeof rawThumb[0] === 'string'
      ? rawThumb[0]
      : typeof rawThumb === 'string' && (rawThumb as string).startsWith('http')
        ? rawThumb
        : null;

  const canMarkSent = isSeller && tx.status === 'paid';
  const canConfirmReceipt = isBuyer && (tx.status === 'shipped' || tx.status === 'delivered');

  // Claim funds: seller-only, after item is shipped and 48 hours have passed
  const shippedTime = tx.shipped_at ? new Date(tx.shipped_at).getTime() : 0;
  const hoursSinceShipped = (Date.now() - shippedTime) / (1000 * 60 * 60);
  const canClaimFunds =
    isSeller &&
    (tx.status === 'shipped' || tx.status === 'delivered') &&
    hoursSinceShipped >= MARKETPLACE_CONSTANTS.AUTO_RELEASE_HOURS;
  const canDispute = (isBuyer || isSeller) && ['paid', 'shipped', 'delivered'].includes(tx.status);
  const canReview = isBuyer && tx.status === 'completed';

  const handleMessageCounterparty = async () => {
    if (!user || !counterparty?.id) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, type, participant_ids')
        .contains('participant_ids', [user.id, counterparty.id]);

      const existing = convs?.find(
        (c) => c.participant_ids?.includes(user.id) && c.participant_ids?.includes(counterparty.id)
      );
      if (existing?.id) {
        router.push(`/chat/${existing.id}` as any);
        return;
      }

      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          type: 'marketplace',
          participant_ids: [user.id, counterparty.id],
        })
        .select('id')
        .single();

      if (newConv?.id) {
        router.push(`/chat/${newConv.id}` as any);
      }
    } catch (e) {
      console.error('Message counterparty error:', e);
      router.push(`/profile/${counterparty.id}` as any);
    }
  };

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      {/* Header */}
      <View
        style={[
          stylesheet.header,
          { backgroundColor: theme.colors.SURFACE, borderBottomColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Transaction
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={stylesheet.scroll} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <Animated.View
          style={[
            stylesheet.statusBanner,
            { backgroundColor: 'transparent', borderColor: meta.color + '50' },
            bannerStyle,
          ]}
        >
          <View
            style={[
              stylesheet.statusIconCircle,
              { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
            ]}
          >
            <Feather name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={stylesheet.statusTextGroup}>
            <Text style={[stylesheet.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={[stylesheet.statusSub, { color: theme.colors.MUTED }]}>
              Transaction #{tx.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Item card */}
        <Animated.View
          style={[
            stylesheet.card,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            card1Style,
          ]}
        >
          <View style={stylesheet.itemRow}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={stylesheet.thumb} contentFit="cover" />
            ) : (
              <View
                style={[
                  stylesheet.thumb,
                  stylesheet.thumbPlaceholder,
                  { backgroundColor: theme.colors.SURFACE },
                ]}
              >
                <Feather name="box" size={24} color={theme.colors.MUTED} />
              </View>
            )}
            <View style={stylesheet.itemInfo}>
              <Text
                style={[stylesheet.itemTitle, { color: theme.colors.TEXT_PRIMARY }]}
                numberOfLines={2}
              >
                {tx.item?.title ?? 'Item'}
              </Text>
              <Text style={[stylesheet.txId, { color: theme.colors.MUTED }]} numberOfLines={1}>
                ID: {tx.id.slice(0, 8)}…
              </Text>
            </View>
          </View>

          <View style={[stylesheet.divider, { backgroundColor: theme.colors.GLASS_BORDER }]} />

          <View style={stylesheet.priceRow}>
            <Text style={[stylesheet.priceLabel, { color: theme.colors.LABEL }]}>Item price</Text>
            <Text style={[stylesheet.priceValue, { color: theme.colors.TEXT_PRIMARY }]}>
              {formatPrice(tx.amount)}
            </Text>
          </View>
          {isSeller && (
            <View style={stylesheet.priceRow}>
              <Text style={[stylesheet.priceLabel, { color: theme.colors.LABEL }]}>
                You'll receive
              </Text>
              <Text style={[stylesheet.priceValue, { color: theme.colors.G }]}>
                {formatPrice(tx.seller_amount)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Counterparty */}
        <Animated.View
          style={[
            stylesheet.card,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            card2Style,
          ]}
        >
          <Text style={[stylesheet.sectionTitle, { color: theme.colors.LABEL }]}>
            {isBuyer ? 'Seller' : 'Buyer'}
          </Text>
          <View style={stylesheet.personRow}>
            {counterparty?.avatar_url ? (
              <Image
                source={{ uri: counterparty.avatar_url }}
                style={stylesheet.avatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  stylesheet.avatar,
                  stylesheet.avatarFallback,
                  { backgroundColor: theme.colors.SURFACE },
                ]}
              >
                <Text style={[stylesheet.avatarInitial, { color: theme.colors.G }]}>
                  {counterparty?.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <Text style={[stylesheet.personName, { color: theme.colors.TEXT_PRIMARY }]}>
              {counterparty?.name ?? 'User'}
            </Text>
            <TouchableOpacity
              style={[stylesheet.messageBtn, { borderColor: theme.colors.G }]}
              onPress={handleMessageCounterparty}
            >
              <Feather name="message-circle" size={16} color={theme.colors.G} />
              <Text style={[stylesheet.messageBtnText, { color: theme.colors.G }]}>Message</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Timeline */}
        <Animated.View
          style={[
            stylesheet.card,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            card3Style,
          ]}
        >
          <Text style={[stylesheet.sectionTitle, { color: theme.colors.LABEL }]}>Timeline</Text>
          {TIMELINE_STEPS.map((step, i) => {
            const done =
              STATUS_ORDER.indexOf(step.status) <= currentStepIndex && tx.status !== 'cancelled';
            const ts = tx[step.tsKey] as string | null;
            return (
              <View key={step.status} style={stylesheet.timelineRow}>
                <View style={stylesheet.timelineLeft}>
                  <View
                    style={[
                      stylesheet.timelineDot,
                      {
                        borderColor: theme.colors.GLASS_BORDER,
                        backgroundColor: theme.colors.SURFACE,
                      },
                      done && [
                        stylesheet.timelineDotDone,
                        { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
                      ],
                    ]}
                  >
                    {done && <Feather name="check" size={12} color="#000" />}
                  </View>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <View
                      style={[
                        stylesheet.timelineLine,
                        { backgroundColor: theme.colors.GLASS_BORDER },
                        done && [stylesheet.timelineLineDone, { backgroundColor: theme.colors.G }],
                      ]}
                    />
                  )}
                </View>
                <View style={stylesheet.timelineContent}>
                  <Text
                    style={[
                      stylesheet.timelineLabel,
                      { color: theme.colors.MUTED },
                      done && [stylesheet.timelineLabelDone, { color: theme.colors.TEXT_PRIMARY }],
                    ]}
                  >
                    {step.label}
                  </Text>
                  {ts ? (
                    <Text style={[stylesheet.timelineTs, { color: theme.colors.MUTED }]}>
                      {fmt(ts)}
                    </Text>
                  ) : (
                    <Text style={[stylesheet.timelinePending, { color: theme.colors.MUTED }]}>
                      Pending
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* Disputed state */}
        {tx.status === 'disputed' && (
          <View style={[stylesheet.card, stylesheet.disputeCard]}>
            <Feather name="alert-triangle" size={20} color="#B71C1C" />
            <Text style={stylesheet.disputeText}>
              A dispute has been raised on this transaction. Our team will review and contact both
              parties within 24 hours.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {canMarkSent && (
          <TouchableOpacity
            style={[
              stylesheet.primaryAction,
              { backgroundColor: theme.colors.G, shadowColor: theme.colors.G },
            ]}
            onPress={handleMarkSent}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="box" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={[stylesheet.primaryActionText, { color: '#000' }]}>
                  Mark Item as Sent
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {canConfirmReceipt && (
          <TouchableOpacity
            style={[
              stylesheet.primaryAction,
              { backgroundColor: theme.colors.G, shadowColor: theme.colors.G },
            ]}
            onPress={handleConfirmReceipt}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={[stylesheet.primaryActionText, { color: '#000' }]}>
                  Confirm I Received the Item
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {canClaimFunds && (
          <TouchableOpacity
            style={[
              stylesheet.primaryAction,
              { backgroundColor: '#1565C0', shadowColor: '#1565C0' },
            ]}
            onPress={handleClaimFunds}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="download" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[stylesheet.primaryActionText, { color: '#fff' }]}>
                  Claim My Funds
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {canDispute && (
          <TouchableOpacity
            style={[
              stylesheet.disputeAction,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(229, 115, 115, 0.1)'
                  : 'rgba(211, 47, 47, 0.08)',
                borderColor: 'transparent',
              },
            ]}
            onPress={() => router.push(`/transactions/${tx.id}/dispute` as any)}
            activeOpacity={0.8}
          >
            <Feather
              name="alert-triangle"
              size={18}
              color={isDarkMode ? '#E57373' : '#D32F2F'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[stylesheet.disputeActionText, { color: isDarkMode ? '#E57373' : '#D32F2F' }]}
            >
              Report an Issue / Dispute
            </Text>
          </TouchableOpacity>
        )}

        {canReview && (
          <TouchableOpacity
            style={[
              stylesheet.reviewAction,
              { borderColor: theme.colors.G, backgroundColor: theme.colors.SURFACE },
            ]}
            onPress={() => router.push(`/transactions/${tx.id}/review` as any)}
          >
            <Feather name="star" size={18} color={theme.colors.G} style={{ marginRight: 8 }} />
            <Text style={[stylesheet.reviewActionText, { color: theme.colors.G }]}>
              Leave a Review
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 14,
  },
  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextGroup: { flex: 1 },
  statusLabel: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statusSub: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 12, marginRight: 14 },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  txId: { fontSize: 11 },
  divider: { height: 1, marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 15, fontWeight: '700' },

  personRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700' },
  personName: { fontSize: 15, fontWeight: '600', flex: 1 },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  messageBtnText: { fontSize: 13, fontWeight: '700' },

  // Timeline
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotDone: {},
  timelineLine: { width: 2, flex: 1, marginVertical: 2, minHeight: 24 },
  timelineLineDone: {},
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineLabel: { fontSize: 14, fontWeight: '500' },
  timelineLabelDone: { fontWeight: '700' },
  timelineTs: { fontSize: 12, marginTop: 2 },
  timelinePending: { fontSize: 12, marginTop: 2 },

  // Disputed
  disputeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFEBEE',
    borderWidth: 0,
  },
  disputeText: { flex: 1, fontSize: 13, color: '#B71C1C', lineHeight: 20 },

  // Actions
  primaryAction: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: { fontSize: 16, fontWeight: '800' },
  disputeAction: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  disputeActionText: { fontSize: 15, fontWeight: '700' },
  reviewAction: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  reviewActionText: { fontSize: 15, fontWeight: '700' },
}));
