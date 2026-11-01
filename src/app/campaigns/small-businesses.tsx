import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  AppState,
  Linking,
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
  'One approved business per owner. Existing and new businesses may enroll. Your interest form does not replace campaign enrollment.',
  'Only Businessplace product orders qualify. Person-to-person marketplace sales, services, bookings, tickets, giveaways and test payments do not count.',
  'Orders must be created after campaign approval. Both creation and completion must occur 1–30 November 2026, Africa/Lagos (WAT). The period ends at 1 December 00:00 WAT, exclusive.',
  'Completion requires buyer-confirmed delivery and provider-confirmed release. One unique order counts once, regardless of quantity or naira value.',
  'Any refund or reversal removes the order. Pending refunds and disputes hold it out of the count until resolved.',
  'Self-purchases are excluded. Related-account and suspicious purchases are reviewed using evidence; genuine repeat customers are allowed. Any adjustment must have a recorded reason.',
  'Equal counts share rank. Verified businesses tied for first split the ₦500,000 first prize equally. Prize shares are reconciled in kobo so the total remains exactly ₦500,000. Revenue never breaks a tie.',
  'Results remain provisional for a seven-day review after closing. Winner verification and finalization happen before announcement.',
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
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [storedData, setData] = useState<CampaignData | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentUser = useRef(userId);
  const identity = userId ?? 'public';
  const data = loadedFor === identity ? storedData : null;
  const [storedMine, setMine] = useState<ParticipantData | null>(null);
  const mine = loadedFor === identity ? storedMine : null;
  const [selected, setSelected] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setMine('participation' in result ? result : null);
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
      setSelected('');
      setAccepted(false);
      setNotice('');
      setError('');
      setSaving(false);
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
  const enroll = async () => {
    if (!selected || !accepted || saving || !userId || currentUser.current !== userId) return;
    setSaving(true);
    setNotice('');
    try {
      await api.post(`${campaignPath}/participation`, { businessId: selected, acceptRules: true });
      if (currentUser.current !== userId) return;
      setNotice('Application received. Your sales start qualifying only after approval.');
      await refresh();
    } catch (e) {
      if (currentUser.current === userId)
        setNotice(e instanceof Error ? e.message : 'Enrollment failed. Please try again.');
    } finally {
      if (currentUser.current === userId) setSaving(false);
    }
  };
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
        <Text style={s.muted}>Approved participant · View profile ↗</Text>
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
            <Text style={s.kicker}>PARTICIPATION</Text>
            {!user ? (
              <>
                <Text style={s.paragraph}>Sign in to choose your business and apply.</Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.button}
                  onPress={() => router.push('/(auth)/login' as never)}
                >
                  <Text style={s.buttonText}>Sign in to participate ↗</Text>
                </Pressable>
              </>
            ) : mine ? (
              mine.participation ? (
                <>
                  <Text style={s.sectionTitle}>
                    {mine.participation.status === 'pending'
                      ? 'Application under review'
                      : mine.participation.status === 'approved'
                        ? 'You’re in. Make it count.'
                        : mine.participation.status === 'suspended'
                          ? 'Participation suspended'
                          : mine.participation.status === 'disqualified'
                            ? 'Participation disqualified'
                            : 'Application not approved'}
                  </Text>
                  {mine.participation.reason && (
                    <Text style={s.paragraph}>{mine.participation.reason}</Text>
                  )}
                  <Text style={s.muted}>
                    {mine.participation.approvedAt
                      ? `Approved ${new Date(mine.participation.approvedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`
                      : 'Qualifying orders can begin only after approval.'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.paragraph}>
                    Choose one business. Enrollment requires review and approval.
                  </Text>
                  {mine.businesses.map((b) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected === b.id }}
                      key={b.id}
                      onPress={() => setSelected(b.id)}
                      style={[s.choice, selected === b.id && s.chosen]}
                    >
                      <Text style={s.business}>
                        {selected === b.id ? '●' : '○'} {b.name}
                      </Text>
                    </Pressable>
                  ))}
                  {!mine.businesses.length && (
                    <Pressable
                      accessibilityRole="button"
                      style={s.outline}
                      onPress={() =>
                        router.push(
                          (profile?.phone_verified
                            ? '/businesses/create'
                            : '/verify-phone') as never
                        )
                      }
                    >
                      <Text style={s.outlineText}>Create your business ↗</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: accepted }}
                    style={s.checkbox}
                    onPress={() => setAccepted((v) => !v)}
                  >
                    <Text style={s.paragraph}>
                      {accepted ? '☑' : '☐'} I accept the campaign rules below, including sale
                      eligibility, winner verification and public display of my business name, logo,
                      profile, rank and sale count.
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled:
                        !accepted ||
                        !selected ||
                        saving ||
                        data?.campaign.status === 'review' ||
                        data?.campaign.status === 'finalized',
                    }}
                    disabled={
                      !accepted ||
                      !selected ||
                      saving ||
                      data?.campaign.status === 'review' ||
                      data?.campaign.status === 'finalized'
                    }
                    style={[s.button, (!accepted || !selected || saving) && s.disabled]}
                    onPress={enroll}
                  >
                    <Text style={s.buttonText}>
                      {saving
                        ? 'Submitting…'
                        : data?.campaign.status === 'review' ||
                            data?.campaign.status === 'finalized'
                          ? 'Enrollment closed'
                          : 'Apply to participate'}
                    </Text>
                  </Pressable>
                </>
              )
            ) : (
              <Text style={s.muted}>
                Participation status unavailable until the campaign loads.
              </Text>
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
              {mine?.ownEntry && entry(mine.ownEntry, true)}
              {data.snapshot.entries.map((row) => entry(row))}
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
                      : 'Approved participants will appear here.'}
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
            accessibilityRole="link"
            style={s.outline}
            onPress={() => Linking.openURL('https://forms.gle/UnREfHXZK4CGLn3KA')}
          >
            <Text style={s.outlineText}>Open interest form ↗</Text>
          </Pressable>
          <Text style={s.muted}>
            Interest form registration is separate from campaign approval.
          </Text>
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
  choice: { padding: 16, borderWidth: 1, borderColor: '#B4C6A9', borderRadius: 14 },
  chosen: { backgroundColor: '#D9EABF', borderColor: '#075C35' },
  checkbox: { minHeight: 48, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
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
