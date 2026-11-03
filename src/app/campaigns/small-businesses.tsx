import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  AppState,
  Share,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/use-supabase-auth';
import { api, WEB_APP_URL } from '@/lib/network/api';
import type { CampaignData, CampaignEntry, ParticipantData } from '@/lib/campaigns/types';

const campaignPath = '/api/campaigns/small-businesses';
const rules = [
  'Every active Businessplace product business joins automatically, including existing businesses.',
  'Only product orders placed through Businessplace count. Services, bookings, event tickets and personal marketplace sales are not part of the competition.',
  'Orders must be placed and completed between 1 and 30 November 2026, Nigeria time.',
  'One completed order adds one sale, no matter how many items are in it or how much it costs.',
  'Orders with a pending refund or dispute do not count until it is resolved. Refunded or reversed orders do not count.',
  'You cannot count an order you placed with your own business. Unusual sales may be checked; genuine repeat customers are welcome.',
  'The business with the most completed sales wins ₦500,000. Businesses tied for first share the prize equally. Sales value never breaks a tie.',
  'After November ends, sales are checked before the winner is announced.',
];
const statusLabels = {
  upcoming: 'UPCOMING · 1 NOVEMBER',
  active: 'CAMPAIGN ACTIVE',
  review: 'ENDED · RESULTS UNDER REVIEW',
  finalized: 'FINAL RESULTS',
};

export default function SmallBusinessesCampaign() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;
  const [storedData, setData] = useState<CampaignData | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentUser = useRef(userId);
  const identity = userId ?? 'public';
  const data = loadedFor === identity ? storedData : null;
  const [storedMine, setMine] = useState<ParticipantData | null>(null);
  const mine = loadedFor === identity ? storedMine : null;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    try {
      let result: CampaignData | ParticipantData;
      if (userId) result = await api.get<ParticipantData>(`${campaignPath}/me`);
      else {
        const response = await fetch(`${WEB_APP_URL}${campaignPath}`);
        if (!response.ok) throw new Error('Campaign unavailable. Please try again.');
        result = await response.json();
      }
      if (id !== generation.current || currentUser.current !== userId) return;
      setData(result);
      setLoadedFor(userId ?? 'public');
      setMine('ownEntries' in result ? result : null);
      setError('');
    } catch (e) {
      if (id === generation.current)
        setError(e instanceof Error ? e.message : 'Scores could not be refreshed.');
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      currentUser.current = userId;
      setMine(null);
      setData(null);
      setNotice('');
      setError('');
      void refresh();
      const activeRefresh = () => {
        if (AppState.currentState === 'active') void refresh();
      };
      const interval = setInterval(activeRefresh, 60000);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        generation.current++;
        clearInterval(interval);
        listener.remove();
      };
    }, [refresh, userId])
  );
  const entry = (row: CampaignEntry, own = false) => (
    <Pressable
      key={`${own ? 'own' : 'leader'}-${row.businessId}`}
      accessibilityRole="link"
      accessibilityLabel={`${own ? 'Your business. ' : ''}Rank ${row.rank}. ${row.name}. ${row.completedSales} completed sales. View business.`}
      onPress={() => router.push(`/businesses/${row.businessId}` as never)}
      style={[s.row, own && s.own]}
    >
      <Text style={s.rank}>{row.rank}</Text>
      {row.logoUrl ? (
        <Image source={{ uri: row.logoUrl }} style={s.logo} />
      ) : (
        <View style={[s.logo, s.fallback]}>
          <Text style={s.monogram}>{row.name.slice(0, 1)}</Text>
        </View>
      )}
      <View style={s.flex}>
        {own && <Text style={s.kicker}>YOUR BUSINESS</Text>}
        <Text style={s.business}>{row.name}</Text>
        <Text style={s.muted}>Businessplace · View profile ↗</Text>
      </View>
      <View>
        <Text style={s.score}>{row.completedSales}</Text>
        <Text style={s.count}>sales</Text>
      </View>
    </Pressable>
  );
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#075C35" />
        }
      >
        <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Text style={s.kicker}>YRDLY × SMALL BUSINESSES</Text>
          <Text style={s.headline}>
            Sell More.{'\n'}
            <Text style={s.green}>Win Big.</Text>
          </Text>
          <Text style={s.tagline}>Join. Sell. Climb. Win.</Text>
          <View style={s.prize}>
            <Text style={s.prizeLabel}>FIRST PRIZE</Text>
            <Text style={s.prizeValue}>₦500,000</Text>
            <Text style={s.prizeCopy}>Up For Grabs! Tied first-place winners share equally.</Text>
          </View>
          <Text style={s.dates}>1–30 November 2026 · WAT</Text>
        </View>
        <View style={s.body}>
          <Text style={s.sectionTitle}>Your hustle. Your climb.</Text>
          <Text style={s.paragraph}>
            The business with the most qualifying completed product orders wins. Naira value never
            determines your rank.
          </Text>
          <View style={s.panel}>
            <Text style={s.kicker}>YOU’RE IN</Text>
            {!user ? (
              <>
                <Text style={s.paragraph}>
                  Create a Businessplace product business and it joins automatically. Sign in to see
                  your business in the standings.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.button}
                  onPress={() => router.push('/(auth)/login' as never)}
                >
                  <Text style={s.buttonText}>Sign in ↗</Text>
                </Pressable>
              </>
            ) : mine?.ownEntries.length ? (
              <>
                <Text style={s.paragraph}>
                  Your Businessplace businesses are included automatically. Every completed product
                  sale adds one.
                </Text>
                {mine.ownEntries.map((row) => entry(row, true))}
              </>
            ) : mine ? (
              <>
                <Text style={s.paragraph}>
                  You’re signed in, but we couldn’t find an eligible Businessplace product business
                  for your account yet.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.outline}
                  onPress={() => router.push('/businesses/create' as never)}
                >
                  <Text style={s.outlineText}>Create your business ↗</Text>
                </Pressable>
              </>
            ) : (
              <Text style={s.muted}>Loading your businesses…</Text>
            )}
            {!!notice && (
              <Text accessibilityLiveRegion="polite" style={s.paragraph}>
                {notice}
              </Text>
            )}
          </View>
          <View style={s.headingRow}>
            <Text style={s.sectionTitle}>The leaderboard</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={s.refresh}>
              <Text style={s.outlineText}>Refresh ↻</Text>
            </Pressable>
          </View>
          {data?.campaign.integrityReviewRequired && (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              New evidence requires additional integrity review before any winner or prize action.
            </Text>
          )}
          {data && (
            <Text style={s.kicker}>
              {statusLabels[data.campaign.status]}
              {data.snapshot.provisional ? ' · PROVISIONAL' : ''}
            </Text>
          )}
          {loading && !data && (
            <ActivityIndicator
              accessibilityLabel="Loading leaderboard"
              color="#075C35"
              style={{ margin: 24 }}
            />
          )}
          {!!error && (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              {data ? 'Showing older scores. ' : ''}
              {error}
            </Text>
          )}
          {data && (
            <>
              <Text style={s.muted}>
                Calculated{' '}
                {new Date(data.snapshot.updatedAt).toLocaleString('en-NG', {
                  timeZone: 'Africa/Lagos',
                })}{' '}
                WAT · {data.snapshot.participantCount} participants
              </Text>
              {mine?.ownEntries
                .filter(
                  (own) => !data.snapshot.entries.some((row) => row.businessId === own.businessId)
                )
                .map((own) => entry(own, true))}
              {data.snapshot.entries.map((row) =>
                entry(
                  row,
                  mine?.ownEntries.some((own) => own.businessId === row.businessId)
                )
              )}
              {!data.snapshot.entries.length && (
                <View style={s.empty}>
                  <Text style={s.business}>
                    {data.snapshot.participantCount
                      ? 'The first sale is still ahead.'
                      : 'Your business could be first.'}
                  </Text>
                  <Text style={s.paragraph}>
                    {data.snapshot.participantCount
                      ? 'No qualifying completed sales yet.'
                      : 'Businessplace product businesses will appear here automatically.'}
                  </Text>
                </View>
              )}
            </>
          )}
          <View style={s.rules}>
            <Text style={s.kicker}>PLAY FAIR. SELL WELL.</Text>
            <Text style={s.sectionTitle}>The rules of the climb</Text>
            {rules.map((rule, i) => (
              <View key={rule} style={s.rule}>
                <Text style={s.ruleNo}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={[s.paragraph, s.flex]}>{rule}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() =>
              Share.share({
                message:
                  'Join YRDLY × Small Businesses. Sell More. Win Big. https://yrdly.ng/campaigns/small-businesses',
              }).catch(() =>
                setNotice('Sharing unavailable. Visit yrdly.ng/campaigns/small-businesses.')
              )
            }
          >
            <Text style={s.buttonText}>Share the campaign ↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFDF4' },
  hero: { backgroundColor: '#F6DB13', padding: 24 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 20 },
  backText: { color: '#123B27', fontSize: 16, fontWeight: '600' },
  kicker: { color: '#075C35', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, lineHeight: 17 },
  headline: {
    fontSize: 64,
    fontFamily: 'Outfit-Bold',
    fontWeight: '900',
    letterSpacing: -3,
    color: '#12291C',
    lineHeight: 66,
    marginVertical: 20,
  },
  green: { color: '#075C35' },
  tagline: { fontSize: 21, fontWeight: '700', color: '#12291C' },
  prize: { backgroundColor: '#075C35', borderRadius: 24, padding: 24, marginTop: 24 },
  prizeLabel: { color: '#F6DB13', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  prizeValue: {
    fontSize: 47,
    fontWeight: '900',
    color: '#F6DB13',
    letterSpacing: -2,
    marginVertical: 8,
  },
  prizeCopy: { color: '#FFFDF4', fontSize: 14, lineHeight: 21 },
  dates: { fontSize: 13, color: '#173D29', marginTop: 20, fontWeight: '600' },
  body: { padding: 20, gap: 16 },
  sectionTitle: {
    fontSize: 27,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    color: '#12291C',
    letterSpacing: -0.6,
  },
  paragraph: { fontSize: 14, lineHeight: 23, color: '#334D3B' },
  panel: { padding: 20, borderRadius: 24, backgroundColor: '#EDF1E4', gap: 14 },
  button: {
    minHeight: 48,
    backgroundColor: '#075C35',
    padding: 16,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  outline: {
    minHeight: 48,
    padding: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#075C35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 14, color: '#075C35', fontWeight: '700' },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  refresh: { minHeight: 44, justifyContent: 'center', padding: 8 },
  muted: { fontSize: 12, lineHeight: 19, color: '#566653' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: '#D6DACF',
  },
  own: {
    borderWidth: 1,
    borderColor: '#075C35',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F0F4DD',
  },
  rank: { fontSize: 22, fontWeight: '700', color: '#075C35', minWidth: 24 },
  logo: { height: 42, width: 42, borderRadius: 13 },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0E8D4' },
  monogram: { fontSize: 22, color: '#075C35', fontWeight: '700' },
  business: { fontSize: 16, fontWeight: '700', color: '#12291C' },
  score: { fontSize: 25, fontWeight: '800', color: '#075C35', textAlign: 'right' },
  count: { fontSize: 11, color: '#566653', textAlign: 'right' },
  flex: { flex: 1 },
  empty: {
    padding: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#899F7E',
    borderRadius: 18,
    gap: 8,
  },
  error: {
    backgroundColor: '#FFF0D4',
    padding: 16,
    color: '#704A0B',
    lineHeight: 22,
    borderRadius: 12,
  },
  rules: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderColor: '#D6DACF', gap: 18 },
  rule: { flexDirection: 'row', gap: 14 },
  ruleNo: { color: '#075C35', fontSize: 12, fontWeight: '800', paddingTop: 4 },
});
