import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import ImagePicker from 'react-native-image-crop-picker';
import { Community, CommunityService } from '@/lib/communities/community-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Avatar } from '@/components/Avatar';
import { CommunityActions, CommunityActionOption } from './CommunityActions';
import { CommunityMedia } from './CommunityMedia';
import { communityScreenStyles as s } from './community-screen-styles';

export function CommunityManagement({
  community,
  role,
  onClose,
  onChanged,
}: {
  community: Community;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const router = useRouter();
  const leader = ['owner', 'admin', 'moderator', 'staff'].includes(role);
  const settingsAllowed = ['owner', 'admin', 'staff'].includes(role);
  const [selectedTab, setTab] = useState('members');
  const tab = !leader || (selectedTab === 'settings' && !settingsAllowed) ? 'members' : selectedTab;
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loadedSection, setLoadedSection] = useState('');
  const sectionKey = `${community.id}:${role}:${tab}:${query}`;
  const visibleRows = loadedSection === sectionKey ? rows : [];
  const [candidates, setCandidates] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const request = useRef(0);
  const [error, setError] = useState('');
  const [actions, setActions] = useState<{
    role: string;
    title: string;
    options: CommunityActionOption[];
  } | null>(null);
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || '');
  const [privacy, setPrivacy] = useState(community.privacy);
  const [rules, setRules] = useState((community.rules || []).join('\n'));
  const [avatar, setAvatar] = useState(community.avatar_url || '');
  const [banner, setBanner] = useState(community.banner_url || '');
  const load = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true);
    setError('');
    setPage(0);
    try {
      let data: any[] = [];
      if (tab === 'members') data = await CommunityService.members(community.id, query);
      if (tab === 'requests') data = await CommunityService.listJoinRequests(community.id);
      if (tab === 'review') {
        data = await CommunityService.reviews(community.id);
        data = await Promise.all(
          data.map(async (item) => ({
            ...item,
            resolved_image_urls: await CommunityService.resolveMedia(item.image_urls || []),
            resolved_video_urls: await CommunityService.resolveMedia(item.video_urls || []),
          }))
        );
      }
      if (tab === 'reports') data = await CommunityService.reports(community.id);
      if (tab === 'invites') {
        data = await CommunityService.listPendingInvites(community.id);
        const found = await CommunityService.inviteCandidates(community.id, query);
        if (revision === request.current) setCandidates(found);
      }
      if (revision === request.current) {
        setRows(data);
        setLoadedSection(sectionKey);
        setHasMore(tab === 'members' && data.length === 50);
      }
    } catch (e: any) {
      if (revision === request.current) setError(e.message || 'Could not load this section.');
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [community.id, tab, query, sectionKey]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`community-management-${community.id}`);
    for (const table of [
      'community_memberships',
      'community_join_requests',
      'community_invites',
      'community_content_reviews',
      'community_reports',
    ]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `community_id=eq.${community.id}` },
        () => void load()
      );
    }
    channel.subscribe();
    const focus = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    const mediaRefresh = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, 240000);
    return () => {
      focus.remove();
      clearInterval(mediaRefresh);
      void supabase.removeChannel(channel);
    };
  }, [community.id, load]);
  const run = async (action: string, data: Record<string, unknown> = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await CommunityService.command(community.id, action, data);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message || 'Could not complete this action.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const confirm = (label: string, action: string, data: Record<string, unknown>) =>
    Alert.alert(label, 'This changes the member’s access to this community.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => void run(action, data) },
    ]);
  const memberActions = (member: any) => {
    if (!leader || member.user_id === user?.id || member.user_id === community.owner_id) return;
    const options: CommunityActionOption[] = [];
    const data = { userId: member.user_id };
    const canManage =
      role === 'staff' ||
      role === 'owner' ||
      (role === 'admin' && member.role !== 'admin') ||
      (role === 'moderator' && member.role === 'member');
    if (!canManage) return;
    if (member.status === 'banned')
      options.push({ label: 'Lift ban', run: () => void run('unban', data) });
    else if (member.status === 'active') {
      if (['owner', 'staff'].includes(role))
        options.push({
          label: member.role === 'admin' ? 'Remove admin role' : 'Make admin',
          run: () =>
            void run('role', { ...data, role: member.role === 'admin' ? 'member' : 'admin' }),
        });
      if (['owner', 'admin', 'staff'].includes(role) && member.role !== 'admin')
        options.push({
          label: member.role === 'moderator' ? 'Remove moderator role' : 'Make moderator',
          run: () =>
            void run('role', {
              ...data,
              role: member.role === 'moderator' ? 'member' : 'moderator',
            }),
        });
      if (role === 'owner' && community.type === 'interest')
        options.push({ label: 'Offer ownership', run: () => void run('offer_ownership', data) });
      options.push(
        {
          label: 'Remove member',
          destructive: true,
          run: () => confirm('Remove this member?', 'remove', data),
        },
        {
          label: 'Ban member',
          destructive: true,
          run: () => confirm('Ban this member?', 'ban', data),
        }
      );
    }
    if (
      role === 'staff' &&
      community.type === 'interest' &&
      !community.owner_id &&
      member.status === 'active'
    )
      options.push({ label: 'Assign owner', run: () => void run('staff_recover', data) });
    if (options.length) setActions({ role, title: member.user?.name || 'Member', options });
  };
  const pickBrand = async (kind: 'avatar' | 'banner') => {
    if (busy || !user) return;
    setBusy(true);
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: kind === 'avatar' ? 900 : 1600,
        height: kind === 'avatar' ? 900 : 600,
        compressImageQuality: 0.85,
      });
      const url = await CommunityService.uploadCommunityImage(
        user.id,
        `${community.id}-${Date.now()}`,
        kind,
        {
          uri: image.path,
          name: image.filename || `${kind}-${Date.now()}.jpg`,
          type: image.mime,
          size: image.size,
        }
      );
      if (kind === 'avatar') setAvatar(url);
      else setBanner(url);
    } catch (e: any) {
      if (e.code !== 'E_PICKER_CANCELLED') setError(e.message || 'Could not upload image.');
    } finally {
      setBusy(false);
    }
  };
  const title = (text: string) => (
    <Text
      style={{
        color: theme.colors.TEXT_PRIMARY,
        fontSize: 20,
        fontFamily: 'Outfit-SemiBold',
        marginVertical: 8,
      }}
    >
      {text}
    </Text>
  );
  const button = (label: string, callback: () => void, danger = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy}
      onPress={callback}
      style={[s.button, { opacity: busy ? 0.5 : 1, marginRight: 8 }]}
    >
      <Text style={[s.buttonLabel, { color: danger ? '#ef4444' : theme.colors.G }]}>{label}</Text>
    </TouchableOpacity>
  );
  const inputStyle = s.input;
  const sectionCopy: Record<string, { label: string; description: string; empty: string }> = {
    members: {
      label: 'Members',
      description: leader
        ? 'The people in your community. Tap a member to see available actions.'
        : 'Get to know the people in your community.',
      empty: query.trim() ? 'No members match your search.' : 'No members to show yet.',
    },
    requests: {
      label: 'Join requests',
      description: 'Review who wants to become part of your community.',
      empty: 'You’re all caught up. No join requests to review.',
    },
    invites: {
      label: 'Invitations',
      description: 'Manage invitations and invite eligible mutual friends.',
      empty: 'No pending invitations.',
    },
    review: {
      label: 'Post review',
      description: 'Check posts and edits before they appear in the community.',
      empty: 'You’re all caught up. Nothing is awaiting review.',
    },
    reports: {
      label: 'Reports',
      description: 'Review reported content and help keep this space welcoming.',
      empty: 'No reports to review.',
    },
    settings: {
      label: 'Settings',
      description: 'Update your community’s identity, membership and rules.',
      empty: '',
    },
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
        <View style={s.managementHeader}>
          <View style={s.headerCopy}>
            <Text style={s.managementTitle}>{leader ? 'Manage community' : 'Members'}</Text>
            <Text style={s.caption} numberOfLines={1}>
              {community.name}
            </Text>
          </View>
          {button('Done', onClose)}
        </View>
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}
        >
          {(leader
            ? [
                'members',
                'requests',
                'invites',
                'review',
                'reports',
                ...(settingsAllowed ? ['settings'] : []),
              ]
            : ['members']
          ).map((section) => (
            <TouchableOpacity
              key={section}
              onPress={() => {
                setTab(section);
                setQuery('');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === section }}
              style={[s.tab, tab === section && s.activeTab]}
            >
              <Text style={[s.tabLabel, tab === section && s.activeTabLabel]}>
                {sectionCopy[section].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
          <Text style={[s.sectionTitle, { marginTop: 8 }]}>{sectionCopy[tab].label}</Text>
          <Text style={[s.caption, { marginBottom: 16 }]}>{sectionCopy[tab].description}</Text>
          {!!error && (
            <View>
              <Text accessibilityRole="alert" style={{ color: '#ef4444' }}>
                {error}
              </Text>
              {button('Try again', () => void load())}
            </View>
          )}
          {['members', 'invites'].includes(tab) && (
            <TextInput
              accessibilityLabel={
                tab === 'members' ? 'Find community members' : 'Find mutual friends'
              }
              style={inputStyle}
              placeholder={tab === 'members' ? 'Search members by name' : 'Search mutual friends'}
              placeholderTextColor={theme.colors.LABEL}
              autoCorrect={false}
              returnKeyType="search"
              value={query}
              onChangeText={setQuery}
            />
          )}
          {busy && <ActivityIndicator color={theme.colors.G} />}
          {loading ? (
            <ActivityIndicator color={theme.colors.G} />
          ) : tab === 'settings' ? (
            <View>
              {title('Community details')}
              <TextInput
                accessibilityLabel="Community name"
                placeholder="Community name"
                placeholderTextColor={theme.colors.LABEL}
                style={inputStyle}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />
              <TextInput
                accessibilityLabel="Description"
                placeholder="Tell people what this community is about"
                placeholderTextColor={theme.colors.LABEL}
                style={inputStyle}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
              />
              {title('Who can join?')}
              {(['open', 'request', 'invite'] as const).map((value) =>
                button(
                  `${privacy === value ? '●' : '○'} ${value === 'open' ? 'Anyone' : value === 'request' ? 'By request' : 'Invite only'}`,
                  () => setPrivacy(value)
                )
              )}
              {title('Rules (one per line)')}
              <TextInput
                accessibilityLabel="Community rules"
                multiline
                style={inputStyle}
                value={rules}
                onChangeText={setRules}
              />
              {button('Change profile image', () => void pickBrand('avatar'))}
              {button('Change banner', () => void pickBrand('banner'))}
              {button(
                'Save changes',
                () =>
                  void run('settings', {
                    name,
                    description,
                    privacy,
                    rules: rules
                      .split('\n')
                      .map((rule) => rule.trim())
                      .filter(Boolean),
                    avatarUrl: avatar,
                    bannerUrl: banner,
                  })
              )}
            </View>
          ) : (
            <View>
              {!visibleRows.length && (
                <View style={s.empty}>
                  <Text style={s.emptyBody}>{sectionCopy[tab].empty}</Text>
                </View>
              )}
              {visibleRows.map((row) => (
                <View key={row.id} style={s.managementRow}>
                  {tab === 'members' && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${row.user?.name || 'Member'}, ${row.user_id === community.owner_id ? 'owner' : row.role}, ${row.status}`}
                      accessibilityHint={
                        leader ? 'Shows available member actions' : 'Opens their profile'
                      }
                      onPress={() => {
                        if (leader) memberActions(row);
                        else {
                          onClose();
                          router.push(`/profile/${row.user_id}` as any);
                        }
                      }}
                      style={{ minHeight: 52 }}
                    >
                      <View style={s.authorRow}>
                        <Avatar
                          url={row.user?.avatar_url}
                          name={row.user?.name || 'Member'}
                          size={44}
                          style={{ width: 44, height: 44, borderRadius: 16 }}
                        />
                        <View style={s.authorCopy}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={s.authorName}>{row.user?.name || 'Member'}</Text>
                            {row.user?.phone_verified && <VerifiedBadge size={16} />}
                          </View>
                          <Text style={s.role}>
                            {row.user_id === community.owner_id ? 'Owner' : row.role} · {row.status}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  {tab === 'requests' && (
                    <View>
                      {title(row.user?.name || 'Join request')}
                      <Text style={{ color: theme.colors.LABEL }}>{row.message}</Text>
                      <View style={{ flexDirection: 'row' }}>
                        {button(
                          'Approve',
                          () =>
                            void run('review_request', {
                              userId: row.user_id,
                              decision: 'approved',
                            })
                        )}
                        {button(
                          'Reject',
                          () =>
                            void run('review_request', {
                              userId: row.user_id,
                              decision: 'rejected',
                            }),
                          true
                        )}
                      </View>
                    </View>
                  )}
                  {tab === 'invites' && (
                    <View>
                      {title(row.recipient?.name || 'Invited friend')}
                      <Text style={{ color: theme.colors.LABEL }}>
                        Expires {new Date(row.expires_at).toLocaleDateString()}
                      </Text>
                      {button(
                        'Revoke invitation',
                        () => void run('revoke_invite', { userId: row.invited_user_id }),
                        true
                      )}
                    </View>
                  )}
                  {tab === 'review' && (
                    <View>
                      {title(
                        row.is_revision
                          ? 'Edited content awaiting review'
                          : 'Content awaiting review'
                      )}
                      <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{row.content}</Text>
                      <CommunityMedia
                        images={row.resolved_image_urls}
                        videos={row.resolved_video_urls}
                      />
                      <Text style={{ color: theme.colors.LABEL }}>
                        {row.reason || 'Awaiting moderation'}
                      </Text>
                      <View style={{ flexDirection: 'row' }}>
                        {button(
                          'Approve',
                          () =>
                            void run('review_content', { reviewId: row.id, decision: 'approved' })
                        )}
                        {button(
                          'Reject',
                          () =>
                            void run('review_content', {
                              reviewId: row.id,
                              decision: 'rejected',
                              reason: 'Does not meet community rules.',
                            }),
                          true
                        )}
                      </View>
                    </View>
                  )}
                  {tab === 'reports' && (
                    <View>
                      {title('Reported ' + row.kind)}
                      <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{row.reason}</Text>
                      {button('View reported content', () => {
                        onClose();
                        if (row.kind === 'post')
                          router.push(`/communities/${community.id}/posts/${row.target_id}` as any);
                        else
                          void supabase
                            .from('community_comments')
                            .select('post_id')
                            .eq('id', row.target_id)
                            .maybeSingle()
                            .then((result) => {
                              if (result.data)
                                router.push(
                                  `/communities/${community.id}/posts/${result.data.post_id}` as any
                                );
                              else Alert.alert('Reply unavailable', 'It may have been removed.');
                            });
                      })}
                      {button(
                        'Remove reported content',
                        () =>
                          Alert.alert(
                            'Remove reported content?',
                            'This permanently removes the content from the community.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: () =>
                                  void run(
                                    row.kind === 'post' ? 'delete_post' : 'delete_comment',
                                    row.kind === 'post'
                                      ? { postId: row.target_id }
                                      : { commentId: row.target_id }
                                  ),
                              },
                            ]
                          ),
                        true
                      )}
                      {button(
                        'Mark resolved',
                        () => void run('resolve_report', { reportId: row.id })
                      )}
                    </View>
                  )}
                </View>
              ))}
              {tab === 'members' &&
                loadedSection === sectionKey &&
                hasMore &&
                button('Load more members', () => {
                  if (loading) return;
                  setLoading(true);
                  void CommunityService.members(community.id, query, page + 1)
                    .then((more) => {
                      setRows((current) => [...current, ...more]);
                      setPage(page + 1);
                      setHasMore(more.length === 50);
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                })}
              {tab === 'invites' && (
                <View>
                  {title('Invite mutual friends')}
                  {!candidates.length && (
                    <Text style={{ color: theme.colors.LABEL }}>
                      No eligible mutual friends found.
                    </Text>
                  )}
                  {candidates.map((friend) => (
                    <View
                      key={friend.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {title(friend.name)}
                      {button('Invite', () => void run('invite', { userId: friend.id }))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
        {leader && actions?.role === role && (
          <CommunityActions
            title={actions.title}
            options={actions.options}
            onClose={() => setActions(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
