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
} from 'phosphor-react-native';
import { CommunityService, Community, CommunityPrivacy } from '@/lib/communities/community-service';
import type { MobileFile } from '@/lib/media/storage-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { useCachedRecords } from '@/hooks/use-cached-records';

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
    JSON.stringify([profile?.home_state, query])
  );
  const [submissions, setSubmissions] = useState<Community[]>([]);
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
    const data = await CommunityService.listMyCommunities().catch(() => []);
    if (currentOwner.current !== owner || mineRequest.current !== request) return;
    setMyComms(data);
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
    setSubmissions([]);
    setPendingNames([]);
    setPrivateOwner(null);
    setShowHistory(false);
  }, [user?.id]);

  const loadDiscover = useCallback(
    async (q?: string) => {
      try {
        const data = await CommunityService.discoverCommunities({
          state: profile?.home_state ?? undefined,
          query: q ?? query,
        });
        setDiscovered(
          data.filter(
            (community) =>
              community.approval_status === 'approved' && community.privacy !== 'invite'
          )
        );
      } catch {
        /* Keep public cached metadata visible offline. */
      }
    },
    [profile?.home_state, query, setDiscovered]
  );

  useEffect(() => {
    const channel = supabase
      .channel('communities-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communities' }, () => {
        void loadMine();
        void loadDiscover(query);
        void loadSubmissions();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMine, loadDiscover, loadSubmissions, query]);

  const load = useCallback(async () => {
    setLoading(true);
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
    if (!user?.id || !name.trim() || !description.trim()) {
      Alert.alert('Missing details', 'Add a community name and description to continue.');
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
      return privateOwner === user?.id && myComms.length > 0 ? [{ title: '', data: myComms }] : [];
    }
    if (query.trim()) {
      return discovered.length > 0 ? [{ title: 'Search Results', data: discovered }] : [];
    }

    const local = discovered.filter((c) => c.type === 'lga' || c.type === 'ward');
    const interests = discovered.filter((c) => c.type === 'interest');

    const res = [];
    if (interests.length > 0) {
      res.push({ title: 'Popular Interests', data: interests });
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
        <Text style={[s.title, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }]}>
          Communities
        </Text>
        <TouchableOpacity
          style={[
            s.createButton,
            {
              backgroundColor: profile?.phone_verified ? theme.colors.G : theme.colors.SURFACE,
              borderColor: theme.colors.GLASS_BORDER,
            },
          ]}
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
            {profile?.phone_verified ? 'Create' : 'Verify to create'}
          </Text>
        </TouchableOpacity>
      </View>

      {(profile?.role === 'admin' ||
        profile?.role === 'moderator' ||
        (profile as any)?.is_admin) && (
        <TouchableOpacity
          onPress={() => router.push('/community-review' as any)}
          style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 4 }}
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
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.colors.G, fontSize: 12 }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

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
          style={[s.searchInput, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Regular' }]}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
        />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['mine', 'discover'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              s.tab,
              tab === t && { borderBottomColor: theme.colors.G, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                s.tabLabel,
                {
                  color: tab === t ? theme.colors.G : theme.colors.LABEL,
                  fontFamily: tab === t ? 'Inter-SemiBold' : 'Inter-Regular',
                },
              ]}
            >
              {t === 'mine' ? 'My Communities' : 'Discover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.G} />
      ) : (
        <SectionList
          stickySectionHeadersEnabled={false}
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.G}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <UsersThree size={48} color={theme.colors.LABEL} weight="light" />
              <Text
                style={[s.emptyText, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}
              >
                {tab === 'mine'
                  ? "You haven't joined any communities yet."
                  : 'No communities found.'}
              </Text>
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
            <TouchableOpacity
              style={[
                s.card,
                {
                  backgroundColor: 'transparent',
                  borderColor: theme.colors.GLASS_BORDER,
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  marginBottom: 0,
                },
              ]}
              activeOpacity={0.82}
              onPress={() => router.push(`/communities/${item.id}` as any)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: theme.colors.G + '22' }]}>
                  <UsersThree size={22} color={theme.colors.G} weight="fill" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text
                    style={[
                      s.commName,
                      { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.privacy === 'invite' && (
                    <Lock size={13} color={theme.colors.LABEL} weight="fill" />
                  )}
                </View>
                <Text
                  style={[s.commMeta, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}
                >
                  {item.member_count} {item.member_count === 1 ? 'member' : 'members'} ·{' '}
                  {item.type === 'ward' ? 'Ward' : item.type === 'lga' ? 'LGA' : 'Group'}
                </Text>
                {item.description ? (
                  <Text
                    style={[
                      s.commDesc,
                      { color: theme.colors.TEXT_SECONDARY, fontFamily: 'Inter-Regular' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <ArrowRight size={18} color={theme.colors.LABEL} />
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 26 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
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
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: 28 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
    marginBottom: 12,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 14 },
  sectionTitle: { fontSize: 18, marginTop: 24, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  commName: { fontSize: 15, flexShrink: 1 },
  commMeta: { fontSize: 12, marginBottom: 2 },
  commDesc: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
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
