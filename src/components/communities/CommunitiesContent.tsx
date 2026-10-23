import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ImagePicker from 'react-native-image-crop-picker';
import {
  MagnifyingGlass,
  UsersThree,
  Lock,
  ArrowRight,
  Plus,
  ShieldCheck,
  X,
  Compass,
} from 'phosphor-react-native';
import { CommunityService, Community, CommunityPrivacy } from '@/lib/communities/community-service';
import type { MobileFile } from '@/lib/media/storage-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { useCachedRecords } from '@/hooks/use-cached-records';

let directoryChannelSequence = 0;

function CommunityDirectoryCard({
  community,
  joined,
  onPress,
}: {
  community: Community;
  joined: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const privacyLabel =
    community.privacy === 'invite'
      ? 'Invite only'
      : community.privacy === 'request'
        ? 'Request to join'
        : 'Open to join';
  const initials = community.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${community.name}, ${community.member_count} members, ${joined ? 'Joined' : privacyLabel}`}
      accessibilityHint={joined ? 'Opens the community and its posts' : 'Opens community details'}
      onPress={onPress}
    >
      <View style={s.cardIdentity}>
        {community.avatar_url && failedImageUrl !== community.avatar_url ? (
          <Image
            source={{ uri: community.avatar_url }}
            style={s.avatar}
            onError={() => setFailedImageUrl(community.avatar_url || null)}
          />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.initials}>{initials || 'C'}</Text>
          </View>
        )}
        <View style={s.cardIdentityText}>
          <Text style={s.communityKind}>
            {community.type === 'ward'
              ? 'WARD COMMUNITY'
              : community.type === 'lga'
                ? 'LOCAL COMMUNITY'
                : 'SHARED INTEREST'}
          </Text>
          <Text style={s.commName} numberOfLines={2}>
            {community.name}
          </Text>
        </View>
        {community.is_official && <ShieldCheck size={20} weight="fill" color={theme.colors.G} />}
      </View>
      <Text style={s.commDesc} numberOfLines={2}>
        {community.description ||
          (community.type === 'interest'
            ? 'A place to connect over the things you love.'
            : 'Meet your neighbours and stay in the loop.')}
      </Text>
      <View style={s.cardFooter}>
        <View style={s.memberMeta}>
          <UsersThree size={16} color={theme.colors.TEXT_SECONDARY} />
          <Text style={s.commMeta}>
            {community.member_count.toLocaleString()}{' '}
            {community.member_count === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <View style={[s.membershipBadge, joined && s.joinedBadge]}>
          {community.privacy === 'invite' && !joined && (
            <Lock size={12} color={theme.colors.TEXT_SECONDARY} />
          )}
          <Text style={[s.membershipText, joined && s.joinedText]}>
            {joined ? 'Joined' : privacyLabel}
          </Text>
          <ArrowRight size={14} color={joined ? theme.colors.G : theme.colors.TEXT_SECONDARY} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function CommunitiesContent({
  embedded = false,
  visible = true,
}: {
  embedded?: boolean;
  visible?: boolean;
}) {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const router = useRouter();
  const { user, profile } = useAuth();

  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [discoverHasMore, setDiscoverHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const discoverPage = useRef(0);
  const discoverRequest = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const [myComms, setMyComms] = useState<Community[]>([]);
  const [privateOwner, setPrivateOwner] = useState<string | null>(null);
  const currentOwner = useRef(user?.id);
  const mineRequest = useRef(0),
    submissionRequest = useRef(0);
  useLayoutEffect(() => {
    currentOwner.current = user?.id;
  }, [user?.id]);
  const [discovered, setDiscovered, communitiesCached] = useCachedRecords<Community>(
    'communities',
    JSON.stringify([profile?.home_state, debouncedQuery])
  );
  const [submissions, setSubmissions] = useState<Community[]>([]);
  const discoveredRef = useRef(discovered);
  useLayoutEffect(() => {
    discoveredRef.current = discovered;
  }, [discovered]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const submissionInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const awaitingApproval = pendingNames.includes(name.trim().replace(/\s+/g, ' ').toLowerCase());
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<MobileFile | null>(null);
  const [bannerFile, setBannerFile] = useState<MobileFile | null>(null);
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('open');

  const loadMine = useCallback(async () => {
    const owner = user?.id,
      request = ++mineRequest.current;
    if (!owner) return;
    let data: Community[], invites: any[];
    try {
      [data, invites] = await Promise.all([
        CommunityService.listMyCommunities(),
        CommunityService.listInvitations(owner),
      ]);
    } catch (error: any) {
      if (currentOwner.current === owner)
        setLoadError(error.message || 'Could not refresh your communities.');
      return;
    }
    if (currentOwner.current !== owner || mineRequest.current !== request) return;
    setMyComms(data);
    setInvitations(invites);
    setPrivateOwner(owner);
  }, [user?.id]);

  const loadSubmissions = useCallback(async () => {
    if (!user?.id) return;
    const owner = user.id,
      request = ++submissionRequest.current;
    const [data, names] = await Promise.all([
      CommunityService.listMyCommunitySubmissions(user.id).catch(() => []),
      CommunityService.pendingSubmissionNames(user.id).catch(() => []),
    ]);
    if (currentOwner.current !== owner || submissionRequest.current !== request) return;
    setSubmissions(data);
    setPendingNames(names);
  }, [user?.id]);

  useEffect(() => {
    setMyComms([]);
    setInvitations([]);
    setSubmissions([]);
    setPendingNames([]);
    setPrivateOwner(null);
    setShowHistory(false);
  }, [user?.id]);

  const loadDiscover = useCallback(
    async (q?: string, append = false) => {
      const request = ++discoverRequest.current;
      try {
        const nextPage = append ? discoverPage.current + 1 : 0;
        const data = await CommunityService.discoverCommunities({
          state: profile?.home_state ?? undefined,
          query: q ?? debouncedQuery,
          page: nextPage,
        });
        if (request !== discoverRequest.current) return;
        discoverPage.current = nextPage;
        setDiscoverHasMore(data.length === 30);
        setDiscovered(
          [...(append ? discoveredRef.current : []), ...data].filter(
            (community) =>
              community.approval_status === 'approved' && community.privacy !== 'invite'
          )
        );
      } catch (error: any) {
        if (request === discoverRequest.current)
          setLoadError(error.message || 'Could not refresh communities.');
        /* Keep public cached metadata visible offline. */
      }
    },
    [profile?.home_state, debouncedQuery, setDiscovered]
  );

  useEffect(() => {
    const channel = supabase
      .channel(`communities-directory-${++directoryChannelSequence}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communities' }, () => {
        void loadMine();
        void loadDiscover(debouncedQuery);
        void loadSubmissions();
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_memberships',
          filter: `user_id=eq.${user?.id}`,
        },
        () => void loadMine()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_invites',
          filter: `invited_user_id=eq.${user?.id}`,
        },
        () => void loadMine()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMine, loadDiscover, loadSubmissions, debouncedQuery, user?.id]);

  const load = useCallback(async () => {
    setLoadError('');
    await Promise.all([loadMine(), loadDiscover(), loadSubmissions()]);
    setLoading(false);
  }, [loadMine, loadDiscover, loadSubmissions]);

  useEffect(() => {
    if (!visible) return;
    void load();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        void loadMine();
        void loadDiscover();
        void loadSubmissions();
      }
    }, 30000);
    return () => {
      app.remove();
      clearInterval(timer);
    };
  }, [load, visible, loadMine, loadDiscover, loadSubmissions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSearch = (t: string) => {
    setQuery(t);
  };

  const pickCommunityImage = async (kind: 'avatar' | 'banner') => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: kind === 'avatar' ? 900 : 1600,
        height: kind === 'avatar' ? 900 : 600,
        compressImageQuality: 0.88,
        compressImageMaxWidth: 2000,
        compressImageMaxHeight: 2000,
      });
      if (image.size > 10 * 1024 * 1024) {
        Alert.alert('Image is too large', 'Choose an image under 10 MB.');
        return;
      }
      const file: MobileFile = {
        uri: image.path,
        name: image.filename || `${kind}-${Date.now()}.jpg`,
        type: image.mime || 'image/jpeg',
        size: image.size,
      };
      if (kind === 'avatar') setAvatarFile(file);
      else setBannerFile(file);
    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED')
        Alert.alert('Could not select image', error.message || 'Try another image.');
    }
  };

  const submitCommunity = async () => {
    if (submissionInFlight.current || awaitingApproval) return;
    if (!user?.id || name.trim().length < 3 || !description.trim()) {
      Alert.alert('Missing details', 'Use a name of at least 3 characters and add a description.');
      return;
    }
    submissionInFlight.current = true;
    setSaving(true);
    try {
      await CommunityService.submitCommunity({
        createdBy: user.id,
        name,
        description,
        avatarFile,
        bannerFile,
        privacy,
      });
      setShowCreate(false);
      setName('');
      setDescription('');
      setAvatarFile(null);
      setBannerFile(null);
      setPrivacy('open');
      await load();
      Alert.alert('Sent for review', 'Your community will appear after a moderator approves it.');
    } catch (error: any) {
      Alert.alert('Could not submit', error.message || 'Please try again.');
    } finally {
      submissionInFlight.current = false;
      setSaving(false);
    }
  };

  const sections = useMemo(() => {
    if (tab === 'mine') {
      const matching = myComms.filter((community) =>
        community.name.toLowerCase().includes(query.trim().toLowerCase())
      );
      return privateOwner === user?.id && matching.length > 0
        ? [{ title: 'Your communities', data: matching }]
        : [];
    }
    if (query.trim()) {
      return discovered.length > 0 ? [{ title: 'Search Results', data: discovered }] : [];
    }

    const local = discovered.filter((c) => c.type === 'lga' || c.type === 'ward');
    const interests = discovered.filter((c) => c.type === 'interest');

    const res = [];
    if (interests.length > 0) {
      res.push({ title: 'Shared interests', data: interests });
    }
    if (local.length > 0) {
      res.push({
        title: profile?.home_state ? `Local to ${profile.home_state}` : 'Local Communities',
        data: local,
      });
    }
    return res;
  }, [tab, query, myComms, discovered, profile, privateOwner, user?.id]);

  const visibleSubmissions = privateOwner === user?.id ? submissions : [];
  return (
    <SafeAreaView
      style={[s.root, { backgroundColor: theme.colors.DARK }]}
      edges={embedded ? [] : ['top']}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>YOUR PEOPLE, YOUR PLACE</Text>
          <Text style={s.title}>Communities</Text>
        </View>
        <TouchableOpacity
          style={[
            s.createButton,
            {
              backgroundColor: profile?.phone_verified ? theme.colors.G : theme.colors.SURFACE,
              borderColor: theme.colors.GLASS_BORDER,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            profile?.phone_verified
              ? 'Create a community'
              : 'Verify your phone to create a community'
          }
          onPress={() =>
            profile?.phone_verified ? setShowCreate(true) : router.push('/verify-phone' as any)
          }
        >
          {profile?.phone_verified ? (
            <Plus size={16} color="#000" />
          ) : (
            <ShieldCheck size={16} color={theme.colors.G} />
          )}
          <Text
            style={{
              color: profile?.phone_verified ? '#000' : theme.colors.G,
              fontFamily: 'Inter-SemiBold',
              fontSize: 12,
            }}
          >
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={s.introduction}>Find your circle. Keep up with your neighbourhood.</Text>

      {(profile?.role === 'admin' ||
        profile?.role === 'moderator' ||
        (profile as any)?.is_admin) && (
        <TouchableOpacity
          onPress={() => router.push('/community-review' as any)}
          accessibilityRole="button"
          style={{ marginHorizontal: 20, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold', fontSize: 12 }}>
            Review community submissions
          </Text>
        </TouchableOpacity>
      )}

      {visibleSubmissions.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setShowHistory((value) => !value)}
          style={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Text style={{ color: theme.colors.G }}>
            Submission history ({visibleSubmissions.length}) {showHistory ? '−' : '+'}
          </Text>
        </TouchableOpacity>
      )}
      {showHistory && visibleSubmissions.length > 0 && (
        <View
          style={[
            s.submissionBox,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
          ]}
        >
          <Text
            style={{
              color: theme.colors.TEXT_PRIMARY,
              fontFamily: 'Inter-SemiBold',
              marginBottom: 8,
            }}
          >
            Your submissions
          </Text>
          {visibleSubmissions.map((item) => (
            <View key={item.id} style={s.submissionRow}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.colors.TEXT_PRIMARY }}>
                  {item.name}
                </Text>
                {item.approval_status === 'rejected' && item.rejection_reason ? (
                  <Text style={{ color: theme.colors.LABEL, fontSize: 11, marginTop: 2 }}>
                    {item.rejection_reason}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  color: item.approval_status === 'pending' ? '#E8B54A' : '#EF4444',
                  fontSize: 11,
                }}
              >
                {item.approval_status === 'pending' ? 'Awaiting review' : 'Rejected'}
              </Text>
              <TouchableOpacity
                accessibilityLabel={`Dismiss ${item.name}`}
                onPress={async () => {
                  if (!user) return;
                  try {
                    await CommunityService.dismissCommunitySubmission(item.id, user.id);
                    setSubmissions((current) => current.filter((row) => row.id !== item.id));
                  } catch {
                    Alert.alert('Could not dismiss', 'Please try again.');
                  }
                }}
                style={{ minHeight: 44, minWidth: 60, padding: 8, justifyContent: 'center' }}
              >
                <Text style={{ color: theme.colors.G, fontSize: 12 }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {!!loadError && (
        <Text accessibilityRole="alert" style={{ color: '#ef4444', padding: 16 }}>
          {loadError} Pull down to try again.
        </Text>
      )}
      {privateOwner === user?.id &&
        invitations.map((invitation) => (
          <View
            key={invitation.id}
            style={{
              marginHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
            }}
          >
            <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}>
              Invitation: {invitation.community?.name || 'Community'}
            </Text>
            <Text style={{ color: theme.colors.LABEL }}>
              Expires {new Date(invitation.expires_at).toLocaleDateString()}
            </Text>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              {(['accept_invite', 'decline_invite'] as const).map((action) => (
                <TouchableOpacity
                  key={action}
                  onPress={async () => {
                    if (submissionInFlight.current) return;
                    submissionInFlight.current = true;
                    try {
                      await CommunityService.command(invitation.community_id, action);
                      await load();
                      if (action === 'accept_invite')
                        router.push(`/communities/${invitation.community_id}` as any);
                    } catch (error: any) {
                      Alert.alert('Could not respond', error.message || 'Please try again.');
                    } finally {
                      submissionInFlight.current = false;
                    }
                  }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ color: theme.colors.G }}>
                    {action === 'accept_invite' ? 'Accept' : 'Decline'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      {communitiesCached && (
        <Text style={{ color: theme.colors.MUTED, paddingHorizontal: 16, fontSize: 12 }}>
          Saved public communities · reconnect to refresh
        </Text>
      )}
      {/* Search */}
      <View
        style={[
          s.searchRow,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <MagnifyingGlass size={18} color={theme.colors.LABEL} />
        <TextInput
          accessibilityLabel="Search communities"
          style={[s.searchInput, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Regular' }]}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
          placeholder={tab === 'mine' ? 'Search your communities' : 'Search communities nationwide'}
          placeholderTextColor={theme.colors.LABEL}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            style={s.clearSearch}
          >
            <X size={18} color={theme.colors.TEXT_SECONDARY} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['mine', 'discover'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.activeTab]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text
              style={[
                s.tabLabel,
                {
                  color: tab === t ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL,
                  fontFamily: tab === t ? 'Inter-SemiBold' : 'Inter-Regular',
                },
              ]}
            >
              {t === 'mine' ? 'My communities' : 'Explore'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View
          style={s.loadingWrap}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading communities"
        >
          <ActivityIndicator color={theme.colors.G} />
          <Text style={s.emptyText}>Finding your communities…</Text>
        </View>
      ) : (
        <SectionList
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          sections={sections}
          keyExtractor={(c) => c.id}
          onEndReached={() => {
            if (tab !== 'discover' || !discoverHasMore || loadingMore) return;
            setLoadingMore(true);
            void loadDiscover(undefined, true).finally(() => setLoadingMore(false));
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.G} /> : null}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Compass size={36} color={theme.colors.G} weight="duotone" />
              </View>
              <Text style={s.emptyTitle}>
                {loadError
                  ? 'Couldn’t load communities'
                  : query.trim()
                    ? 'No matches yet'
                    : tab === 'mine'
                      ? 'Your circle starts here'
                      : 'More connections ahead'}
              </Text>
              <Text style={s.emptyText}>
                {loadError
                  ? 'Check your connection and try again.'
                  : query.trim()
                    ? 'Try another name or clear your search.'
                    : tab === 'mine'
                      ? 'Join a community to swap ideas, ask questions and meet people around you.'
                      : 'Search nationwide or start a community of your own.'}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={s.emptyAction}
                onPress={() => {
                  if (loadError) {
                    void onRefresh();
                    return;
                  }
                  if (query.trim()) {
                    setQuery('');
                    return;
                  }
                  if (tab === 'mine') {
                    setTab('discover');
                    return;
                  }
                  if (profile?.phone_verified) setShowCreate(true);
                  else router.push('/verify-phone' as any);
                }}
              >
                <Text style={s.emptyActionLabel}>
                  {loadError
                    ? 'Try again'
                    : query.trim()
                      ? 'Clear search'
                      : tab === 'mine'
                        ? 'Explore communities'
                        : 'Start a community'}
                </Text>
                <ArrowRight size={18} color="#000" />
              </TouchableOpacity>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderSectionHeader={({ section: { title } }) =>
            title ? (
              <Text
                style={[
                  s.sectionTitle,
                  { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' },
                ]}
              >
                {title}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <CommunityDirectoryCard
              community={item}
              joined={
                privateOwner === user?.id && myComms.some((community) => community.id === item.id)
              }
              onPress={() => router.push(`/communities/${item.id}` as any)}
            />
          )}
        />
      )}

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={s.modalBackdrop}>
          <View
            style={[
              s.createModal,
              { backgroundColor: theme.colors.DARK, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <Text
              style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold', fontSize: 19 }}
            >
              Create a community
            </Text>
            <Text
              style={{ color: theme.colors.LABEL, fontSize: 12, marginTop: 4, marginBottom: 12 }}
            >
              A moderator will review the details before it goes live.
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={60}
                placeholder="Community name"
                placeholderTextColor={theme.colors.LABEL}
                style={[
                  s.formInput,
                  { color: theme.colors.TEXT_PRIMARY, borderColor: theme.colors.GLASS_BORDER },
                ]}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                placeholder="Description"
                placeholderTextColor={theme.colors.LABEL}
                style={[
                  s.formInput,
                  s.descriptionInput,
                  { color: theme.colors.TEXT_PRIMARY, borderColor: theme.colors.GLASS_BORDER },
                ]}
              />
              <Text style={{ color: theme.colors.TEXT_PRIMARY, marginBottom: 6 }}>
                Profile image{' '}
                <Text style={{ color: theme.colors.LABEL, fontSize: 11 }}>
                  (optional, up to 10 MB)
                </Text>
              </Text>
              <TouchableOpacity
                onPress={() => pickCommunityImage('avatar')}
                style={[s.imagePickerRow, { borderColor: theme.colors.GLASS_BORDER }]}
              >
                {avatarFile ? (
                  <Image source={{ uri: avatarFile.uri }} style={s.avatarPreview} />
                ) : (
                  <View
                    style={[
                      s.avatarPreview,
                      s.imagePlaceholder,
                      { backgroundColor: theme.colors.SURFACE },
                    ]}
                  >
                    <UsersThree size={21} color={theme.colors.LABEL} />
                  </View>
                )}
                <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold' }}>
                  {avatarFile ? 'Change profile image' : 'Choose profile image'}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.TEXT_PRIMARY, marginTop: 12, marginBottom: 6 }}>
                Banner image{' '}
                <Text style={{ color: theme.colors.LABEL, fontSize: 11 }}>
                  (optional, up to 10 MB)
                </Text>
              </Text>
              <TouchableOpacity
                onPress={() => pickCommunityImage('banner')}
                style={[s.bannerPickerRow, { borderColor: theme.colors.GLASS_BORDER }]}
              >
                {bannerFile ? (
                  <Image source={{ uri: bannerFile.uri }} style={s.bannerPreview} />
                ) : (
                  <View
                    style={[
                      s.bannerPreview,
                      s.imagePlaceholder,
                      { backgroundColor: theme.colors.SURFACE },
                    ]}
                  >
                    <UsersThree size={21} color={theme.colors.LABEL} />
                  </View>
                )}
                <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold' }}>
                  {bannerFile ? 'Change banner image' : 'Choose banner image'}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.LABEL, marginTop: 4, marginBottom: 8 }}>
                Membership
              </Text>
              <View style={s.privacyOptions}>
                {(
                  [
                    ['open', 'Anyone'],
                    ['request', 'By request'],
                    ['invite', 'Invite only'],
                  ] as const
                ).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setPrivacy(value)}
                    style={[
                      s.privacyOption,
                      {
                        borderColor: privacy === value ? theme.colors.G : theme.colors.GLASS_BORDER,
                        backgroundColor: privacy === value ? theme.colors.G + '18' : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: privacy === value ? theme.colors.G : theme.colors.TEXT_PRIMARY,
                        fontSize: 12,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={s.modalAction}>
                <Text style={{ color: theme.colors.LABEL }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving || awaitingApproval}
                onPress={submitCommunity}
                style={[s.modalAction, { backgroundColor: theme.colors.G }]}
              >
                <Text style={{ color: '#000', fontFamily: 'Inter-SemiBold' }}>
                  {saving ? 'Sending…' : awaitingApproval ? 'Awaiting approval' : 'Send for review'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: theme.colors.G,
    marginBottom: 5,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Outfit-Bold',
    color: theme.colors.TEXT_PRIMARY,
    letterSpacing: -0.8,
  },
  introduction: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.TEXT_SECONDARY,
    fontFamily: 'Inter-Regular',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
  },
  submissionBox: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  submissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 52,
  },
  searchInput: { flex: 1, fontSize: 14, minHeight: 48, paddingVertical: 10 },
  clearSearch: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.colors.SURFACE,
    borderColor: theme.colors.GLASS_BORDER,
    borderWidth: 1,
    padding: 4,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: theme.colors.DARK,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  tabLabel: { fontSize: 13 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  sectionTitle: { fontSize: 20, marginTop: 22, marginBottom: 14 },
  card: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: theme.colors.SURFACE,
    borderColor: theme.colors.GLASS_BORDER,
    gap: 14,
  },
  cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIdentityText: { flex: 1, minWidth: 0, gap: 4 },
  communityKind: {
    color: theme.colors.TEXT_SECONDARY,
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 1,
  },
  avatar: { width: 58, height: 58, borderRadius: 18 },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.G + '20',
    borderWidth: 1,
    borderColor: theme.colors.G + '35',
  },
  initials: { fontFamily: 'Outfit-Bold', color: theme.colors.G, fontSize: 23 },
  commName: {
    fontSize: 19,
    lineHeight: 24,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Outfit-SemiBold',
  },
  commMeta: {
    fontSize: 12,
    color: theme.colors.TEXT_SECONDARY,
    fontFamily: 'Inter-Regular',
    flexShrink: 1,
  },
  commDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.TEXT_SECONDARY,
    fontFamily: 'Inter-Regular',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
    paddingTop: 12,
  },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: theme.colors.DARK,
  },
  joinedBadge: { backgroundColor: theme.colors.G + '16' },
  membershipText: {
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.TEXT_SECONDARY,
    fontSize: 11,
  },
  joinedText: { color: theme.colors.G },
  loadingWrap: { alignItems: 'center', paddingTop: 56, gap: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 42, paddingBottom: 24, gap: 14 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: theme.colors.G + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 24,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Outfit-SemiBold',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.TEXT_SECONDARY,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: theme.colors.G,
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 4,
  },
  emptyActionLabel: { color: '#000', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  createModal: { maxHeight: '90%', borderRadius: 18, borderWidth: 1, padding: 18 },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 14,
  },
  descriptionInput: { minHeight: 90, textAlignVertical: 'top' },
  imagePickerRow: {
    minHeight: 76,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerPickerRow: {
    minHeight: 86,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPreview: { width: 54, height: 54, borderRadius: 27 },
  bannerPreview: { width: 110, height: 62, borderRadius: 8 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  privacyOptions: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  privacyOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  modalAction: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
}));
