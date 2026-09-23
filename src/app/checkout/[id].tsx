import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/utils';
import { MARKETPLACE_CONSTANTS } from '../../lib/constants';
import { PaylukCheckout } from '../../components/PaylukCheckout';
const COMMISSION_RATE = MARKETPLACE_CONSTANTS.COMMISSION_RATE;
const PAYLUK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYLUK_PUBLIC_KEY ?? '';

interface ItemDetails {
  id: string;
  title: string;
  price: number;
  image_urls?: string[];
  image_url?: string;
  user_id: string;
  seller?: { id: string; name: string; email: string };
  condition?: string;
  area?: string;
}

// Response shape from /api/payment/initialize
interface InitializeResponse {
  success: boolean;
  transactionId: string;
  totalAmount: number; // Server-authoritative; use instead of recomputing locally
  paymentLink?: string; // Undefined for Payluk and free items
  paylukEscrowId?: string; // Present when Payluk is active
  paylukPaymentToken?: string;
}

type Stage = 'loading' | 'summary' | 'payluk_checkout' | 'error';

export default function CheckoutScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const { id, type = 'marketplace_post' } = useLocalSearchParams<{ id: string; type?: string }>();
  const { user, profile } = useAuth();

  const [stage, setStage] = useState<Stage>('loading');
  const [item, setItem] = useState<ItemDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'meetup' | 'delivery'>('meetup');

  // Payluk SDK state
  const [paylukTransactionId, setPaylukTransactionId] = useState<string | null>(null);
  const [paylukTotalAmount, setPaylukTotalAmount] = useState<number>(0); // server-authoritative
  const [showCheckout, setShowCheckout] = useState(false);
  const [paylukToken, setPaylukToken] = useState<string | null>(null);

  // 1. Fetch item + seller info
  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      if (type === 'catalog_item') {
        const { data, error } = await supabase
          .from('catalog_items')
          .select('id, title, price, images, business_id, businesses(owner_id, name)')
          .eq('id', id)
          .single();

        if (error || !data) throw error ?? new Error('Not found');

        const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
        if (!business) throw new Error('Business not found');

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', business.owner_id)
          .single();

        if (userError || !userData) throw userError ?? new Error('Owner not found');

        setItem({
          id: data.id,
          title: data.title,
          price: data.price,
          image_urls: data.images,
          user_id: business.owner_id,
          seller: { id: userData.id, name: business.name || userData.name, email: userData.email },
          condition: 'New',
          area: 'Nigeria',
        });
        setStage('summary');
      } else {
        const { data, error } = await supabase
          .from('posts')
          .select(
            'id, title, price, image_url, image_urls, condition, location, user_id, user:users!posts_user_id_fkey(id, name, email)'
          )
          .eq('id', id)
          .single();
        if (error || !data) throw error ?? new Error('Not found');

        const seller = Array.isArray(data.user) ? data.user[0] : data.user;
        let area = 'Lagos';
        if (data.location && typeof data.location === 'object' && data.location.area) {
          area = data.location.area;
        }

        setItem({ ...data, seller, area } as any);
        setStage('summary');
      }
    } catch {
      Alert.alert('Error', 'Item not found.', [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [id, type]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // ── Payluk: open Inline Checkout SDK ────────────────────────────────────
  const enterPaylukFlow = useCallback((transactionId: string, totalAmount: number, paymentToken: string) => {
    console.log('[Checkout] enterPaylukFlow — transactionId:', transactionId, 'token:', paymentToken);
    setPaylukTransactionId(transactionId);
    setPaylukTotalAmount(totalAmount);
    setPaylukToken(paymentToken);
    setShowCheckout(true);
    setStage('payluk_checkout');
  }, []);

  // ── Payluk SDK callbacks ─────────────────────────────────────────────────
  const handleCheckoutSuccess = useCallback(() => {
    setShowCheckout(false);
    console.log('[Checkout] SDK success — subscribing to realtime for tx:', paylukTransactionId);
    // The webhook will update the DB; subscribe to realtime to catch it
    const channel = supabase
      .channel(`tx-paid-${paylukTransactionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'escrow_transactions', filter: `id=eq.${paylukTransactionId}` },
        (payload) => {
          if (payload.new?.status === 'paid' || payload.new?.status === 'PAID') {
            supabase.removeChannel(channel);
            router.replace({
              pathname: '/checkout/success',
              params: { transactionId: paylukTransactionId, itemTitle: item?.title, amount: String(paylukTotalAmount) },
            } as any);
          }
        }
      )
      .subscribe();

    // Fallback: navigate after 8 seconds even if realtime is delayed
    setTimeout(() => {
      supabase.removeChannel(channel);
      router.replace({
        pathname: '/checkout/success',
        params: { transactionId: paylukTransactionId, itemTitle: item?.title, amount: String(paylukTotalAmount) },
      } as any);
    }, 8000);
  }, [paylukTransactionId, paylukTotalAmount, item]);

  const handleCheckoutCancel = useCallback(() => {
    setShowCheckout(false);
    setStage('summary');
  }, []);

  const handleCheckoutError = useCallback((msg: string) => {
    setShowCheckout(false);
    if (msg === 'PHONE_VERIFICATION_REQUIRED') {
      router.push('/verify-phone' as any);
      return;
    }
    setStage('error');
    setErrorMsg(msg || 'Payment could not be completed.');
  }, []);

  // 2. Initialize payment via web API
  const handleInitializePayment = async () => {
    if (!item || !user || !profile) {
      console.log('[Checkout] handleInitializePayment — missing state:', {
        item: !!item,
        user: !!user,
        profile: !!profile,
      });
      return;
    }

    if (item.user_id === user.id) {
      Alert.alert('Error', "You can't buy your own item.");
      return;
    }

    console.log(
      '[Checkout] handleInitializePayment — itemId:',
      item.id,
      'sellerId:',
      item.user_id,
      'price:',
      item.price,
      'itemType:',
      type
    );
    setStage('loading');
    setErrorMsg('');
    try {
      const payload = {
        itemId: item.id,
        buyerId: user.id,
        sellerId: item.user_id,
        price: item.price ?? 0,
        buyerEmail: user.email || 'no-email@yrdly.ng',
        buyerName: profile?.name ?? user.user_metadata?.name ?? 'Yrdly User',
        itemTitle: item.title,
        sellerName: item.seller?.name ?? 'Seller',
        itemType: type === 'catalog_item' ? 'catalog_item' : 'post',
      };
      console.log('[Checkout] POST /api/payment/initialize payload:', JSON.stringify(payload));

      const result = await api.post<InitializeResponse>('/api/payment/initialize', payload);
      console.log('[Checkout] /api/payment/initialize response:', JSON.stringify(result));

      // ── Payluk path: paylukPaymentToken present ──
      if (result.paylukPaymentToken) {
        console.log('[Checkout] → Payluk SDK path. token:', result.paylukPaymentToken, 'tx:', result.transactionId);
        enterPaylukFlow(result.transactionId, result.totalAmount, result.paylukPaymentToken);
        return;
      }

      // ── Free item path: no paymentLink ──
      if (!result.paymentLink) {
        console.log('[Checkout] → Free item path. transactionId:', result.transactionId);
        router.replace({
          pathname: '/checkout/success',
          params: {
            transactionId: result.transactionId,
            itemTitle: item.title,
            amount: String(item.price),
          },
        } as any);
        return;
      }

      // ── Fallback error ──
      console.log(
        '[Checkout] → Unexpected: paymentLink present but no Payluk. result:',
        JSON.stringify(result)
      );
      setStage('error');
      setErrorMsg('Unexpected response from server. Please try again.');
    } catch (e: any) {
      console.log('[Checkout] handleInitializePayment error:', e?.message, e);
      if (e?.message === 'PHONE_VERIFICATION_REQUIRED') {
        router.push('/verify-phone' as any);
        return;
      }

      setStage('error');
      let msg = e?.message ?? 'Could not initialize payment.';
      if (msg === 'SELLER_PHONE_UNVERIFIED') {
        msg = 'The seller has not verified their phone number. Payment cannot proceed.';
      }
      setErrorMsg(msg);
    }
  };

  const commission = item ? Math.round(item.price * COMMISSION_RATE) : 0;
  const totalAmount = paylukTotalAmount > 0 ? paylukTotalAmount : (item?.price ?? 0) + commission;
  const thumbnail = item?.image_urls?.[0] || item?.image_url;

  // ── Loading ──────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  // ── Payluk Checkout SDK (fullscreen modal) ────────────────────
  // Rendered on top of summary; summary stays mounted underneath for cancel UX
  const checkoutModal = showCheckout && paylukToken ? (
    <PaylukCheckout
      paymentToken={paylukToken}
      publicKey={PAYLUK_PUBLIC_KEY}
      amount={totalAmount}
      onSuccess={handleCheckoutSuccess}
      onCancel={handleCheckoutCancel}
      onError={handleCheckoutError}
    />
  ) : null;

  // ── Error ────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <Feather name="alert-circle" size={48} color="#E53935" />
        <Text style={[stylesheet.errorTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Payment failed
        </Text>
        <Text style={[stylesheet.errorMsg, { color: theme.colors.LABEL }]}>{errorMsg}</Text>
        <TouchableOpacity
          style={[stylesheet.retryBtn, { backgroundColor: theme.colors.SURFACE }]}
          onPress={() => setStage('summary')}
        >
          <Text style={[stylesheet.retryBtnText, { color: theme.colors.TEXT_PRIMARY }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Order Summary ────────────────────────────────────────────
  return (
    <>
      <SafeAreaView
        style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
        edges={['top', 'bottom']}
      >
      {/* Header */}
      <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Feather name="chevron-left" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>Checkout</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={stylesheet.scroll} showsVerticalScrollIndicator={false}>
        {/* Item summary card */}
        <View style={[stylesheet.card, { flexDirection: 'row', gap: 16 }]}>
          <View style={stylesheet.itemThumbWrapper}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={stylesheet.itemThumb} contentFit="cover" />
            ) : (
              <View
                style={[
                  stylesheet.itemThumb,
                  {
                    backgroundColor: theme.colors.SURFACE,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Feather name="image" size={24} color={theme.colors.MUTED} />
              </View>
            )}
          </View>
          <View style={stylesheet.itemInfo}>
            <Text style={stylesheet.itemTitle} numberOfLines={2}>
              {item?.title}
            </Text>
            <Text style={stylesheet.itemMeta}>Seller: {item?.seller?.name ?? 'Seller'}</Text>
            <Text style={stylesheet.itemMeta}>
              {item?.condition ?? 'Used'} · {item?.area ?? 'Lagos'}
            </Text>
          </View>
        </View>

        {/* Delivery / Pickup */}
        <View style={stylesheet.card}>
          <Text style={stylesheet.sectionTitle}>PICKUP / MEET-UP</Text>

          {/* Meetup Option */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={stylesheet.optionRow}
            onPress={() => setDeliveryMethod('meetup')}
          >
            <View
              style={[
                stylesheet.radioOuter,
                {
                  borderColor:
                    deliveryMethod === 'meetup' ? theme.colors.G : theme.colors.GLASS_BORDER,
                },
              ]}
            >
              {deliveryMethod === 'meetup' && <View style={stylesheet.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  stylesheet.optionTitle,
                  { color: theme.colors.TEXT_PRIMARY },
                ]}
              >
                Meet-up · {item?.area ?? 'Local Area'}
              </Text>
              <Text style={stylesheet.optionDesc}>Agree a safe public meeting point</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Price breakdown */}
        <View style={stylesheet.card}>
          <Text style={stylesheet.sectionTitle}>ORDER SUMMARY</Text>

          <View style={stylesheet.priceRow}>
            <Text style={stylesheet.priceLabel}>Item price</Text>
            <Text style={stylesheet.priceValue}>{formatPrice(item?.price ?? 0)}</Text>
          </View>
          <View style={stylesheet.priceRow}>
            <Text style={stylesheet.priceLabel}>Platform fee</Text>
            <Text style={stylesheet.priceValue}>{formatPrice(commission)}</Text>
          </View>

          <View style={stylesheet.divider} />

          <View style={stylesheet.totalRow}>
            <Text style={stylesheet.totalLabel}>Total</Text>
            <Text style={stylesheet.totalValue}>{formatPrice(totalAmount)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={stylesheet.footer}>
        <TouchableOpacity
          style={stylesheet.payBtn}
          onPress={handleInitializePayment}
          activeOpacity={0.85}
        >
          <Text style={stylesheet.payBtnText}>Pay {formatPrice(totalAmount)}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    {checkoutModal}
    </>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', flex: 1 },

  card: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
    padding: 16,
  },
  itemThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  itemMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 2,
  },

  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.G,
  },
  optionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  optionDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginTop: 2,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
  },
  priceValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.GLASS_BORDER,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
  },
  totalValue: {
    fontFamily: 'Outfit-Black',
    fontSize: 18,
    color: theme.colors.G,
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
  },
  payBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: '#000',
  },

  payingIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payingTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  payingSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.MUTED,
  },

  errorTitle: { fontSize: 22, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  errorMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24, maxWidth: 280 },
  retryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  retryBtnText: { fontWeight: '700', fontSize: 15 },
}));
