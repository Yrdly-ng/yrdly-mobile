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
import { CommunityActions, CommunityActionOption } from './CommunityActions';
import { CommunityMedia } from './CommunityMedia';

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
  const [tab, setTab] = useState('members');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const request = useRef(0);
  const [error, setError] = useState('');
  const [actions, setActions] = useState<{
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
        setHasMore(tab === 'members' && data.length === 50);
      }
    } catch (e: any) {
      if (revision === request.current) setError(e.message || 'Could not load this section.');
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [community.id, tab, query]);
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
    if (options.length) setActions({ title: member.user?.name || 'Member', options });
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
        fontSize: 17,
        fontFamily: 'Inter-SemiBold',
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
      style={{ paddingVertical: 12, paddingHorizontal: 8, opacity: busy ? 0.5 : 1 }}
    >
      <Text style={{ color: danger ? '#ef4444' : theme.colors.G }}>{label}</Text>
    </TouchableOpacity>
  );
  const inputStyle = {
    color: theme.colors.TEXT_PRIMARY,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
          }}
        >
          {title(leader ? 'Manage community' : 'Community members')}
          {button('Close', onClose)}
        </View>
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 12 }}
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
              style={{
                padding: 12,
                borderBottomWidth: tab === section ? 2 : 0,
                borderColor: theme.colors.G,
              }}
            >
              <Text
                style={{
                  color: tab === section ? theme.colors.G : theme.colors.LABEL,
                  textTransform: 'capitalize',
                }}
              >
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        >
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
                style={inputStyle}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />
              <TextInput
                accessibilityLabel="Description"
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
              {!rows.length && (
                <Text style={{ color: theme.colors.LABEL, paddingVertical: 16 }}>
                  Nothing here yet.
                </Text>
              )}
              {rows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderColor: theme.colors.GLASS_BORDER,
                  }}
                >
                  {tab === 'members' && (
                    <TouchableOpacity onPress={() => memberActions(row)}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {title(row.user?.name || 'Member')}
                        {row.user?.phone_verified && <VerifiedBadge size={16} />}
                      </View>
                      <Text style={{ color: theme.colors.LABEL }}>
                        {row.user_id === community.owner_id ? 'owner' : row.role} · {row.status}
                        {leader ? ' · Tap to manage' : ''}
                      </Text>
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
                          void run(row.kind === 'post' ? 'delete_post' : 'delete_comment', {
                            targetId: row.target_id,
                            kind: row.kind,
                          }),
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
              {hasMore &&
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
        {actions && <CommunityActions {...actions} onClose={() => setActions(null)} />}
      </SafeAreaView>
    </Modal>
  );
}
