import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, DotsThree, Heart, ChatCircle, Bell, BellSlash } from 'phosphor-react-native';
import {
  CommunityService,
  Community,
  CommunityPost,
  CommunityMembership,
  CommunityJoinRequest,
} from '@/lib/communities/community-service';
import { supabase } from '@/lib/supabase/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { useNotificationRouteAcknowledgement } from '@/hooks/notifications/use-notification-route-ack';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { CommunityActions, CommunityActionOption } from '@/components/communities/CommunityActions';
import { CommunityManagement } from '@/components/communities/CommunityManagement';
import { CommunityComposer } from '@/components/communities/CommunityComposer';
import { CommunityMedia, CommunityRevisionNotice } from '@/components/communities/CommunityMedia';
import { timeAgo } from '@/lib/shared/utils';

export default function CommunityFeedScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [request, setRequest] = useState<CommunityJoinRequest | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [areaPosts, setAreaPosts] = useState<CommunityPost[]>([]);
  const [invite, setInvite] = useState<any>(null);
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const page = useRef(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [managing, setManaging] = useState(false);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<CommunityPost | undefined>();
  const [menu, setMenu] = useState<{ title: string; options: CommunityActionOption[] } | null>(
    null
  );
  const revision = useRef(0);
  const likedInFlight = useRef(new Set<string>());
  const active = membership?.status === 'active';
  const role =
    profile?.is_admin || ['admin', 'moderator'].includes(profile?.role || '')
      ? 'staff'
      : community?.owner_id === user?.id
        ? 'owner'
        : active
          ? membership!.role
          : '';
  const leader = ['staff', 'owner', 'admin', 'moderator'].includes(role);
  useNotificationRouteAcknowledgement(!loading && !!community);
  const load = useCallback(async () => {
    if (!id || !user?.id) return;
    const started = ++revision.current;
    setError('');
    try {
      const [comm, mem, join, feed, ownership, invitation] = await Promise.all([
        CommunityService.getCommunity(id),
        CommunityService.getMyMembership(id, user.id),
        CommunityService.getMyJoinRequest(id, user.id),
        CommunityService.fetchPosts(id),
        CommunityService.ownershipOffer(id),
        CommunityService.getMyInvite(id, user.id),
      ]);
      if (started !== revision.current) return;
      setCommunity(comm);
      setMembership(mem);
      setRequest(join);
      setInvite(invitation);
      setOffer(ownership);
      page.current = 0;
      setHasMore(feed.length === 20);
      if (feed.length) {
        const liked = await supabase
          .from('community_post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in(
            'post_id',
            feed.map((post) => post.id)
          );
        if (liked.error) throw liked.error;
        const ids = new Set((liked.data || []).map((row) => row.post_id));
        if (started === revision.current)
          setPosts(feed.map((post) => ({ ...post, liked_by_me: ids.has(post.id) })));
      } else setPosts([]);
      if (
        comm?.type === 'ward' &&
        mem?.status === 'active' &&
        (await CommunityService.isWardSparse(id))
      ) {
        const parent = await CommunityService.fetchParentLgaPosts(id);
        if (started === revision.current) setAreaPosts(parent);
      } else setAreaPosts([]);
    } catch (e: any) {
      if (started === revision.current) setError(e.message || 'Could not load this community.');
    } finally {
      if (started === revision.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [id, user?.id]);
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setCommunity(null);
      setMembership(null);
      setPosts([]);
      void load();
      const channel = supabase.channel(`community-screen-${id}`);
      for (const table of [
        'communities',
        'community_memberships',
        'community_posts',
        'community_join_requests',
        'community_invites',
        'community_ownership_transfers',
        'community_content_reviews',
      ])
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: table === 'communities' ? `id=eq.${id}` : `community_id=eq.${id}`,
          },
          () => void load()
        );
      channel
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'community_posts' },
          () => void load()
        )
        .subscribe();
      const app = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      const mediaRefresh = setInterval(() => {
        if (AppState.currentState === 'active') void load();
      }, 240000);
      return () => {
        clearInterval(mediaRefresh);
        revision.current++;
        app.remove();
        void supabase.removeChannel(channel);
      };
    }, [id, load])
  );
  const run = async (action: string, data: Record<string, unknown> = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await CommunityService.command(id, action, data);
      await load();
    } catch (e: any) {
      Alert.alert('Could not complete action', e.message || 'Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const like = async (post: CommunityPost) => {
    if (!user || likedInFlight.current.has(post.id)) return;
    likedInFlight.current.add(post.id);
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked_by_me: !post.liked_by_me,
              like_count: Math.max(0, item.like_count + (post.liked_by_me ? -1 : 1)),
            }
          : item
      )
    );
    try {
      await CommunityService.togglePostLike(post.id, user.id, !!post.liked_by_me);
    } catch (e: any) {
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, liked_by_me: post.liked_by_me, like_count: post.like_count }
            : item
        )
      );
      Alert.alert('Could not save like', e.message || 'Please try again.');
    } finally {
      likedInFlight.current.delete(post.id);
    }
  };
  const postActions = (post: CommunityPost) => {
    const options: CommunityActionOption[] = [];
    if (post.author_id === user?.id)
      options.push({
        label: 'Edit post',
        run: () => {
          setEditing(post);
          setComposing(true);
        },
      });
    if (leader)
      options.push({
        label: post.is_pinned ? 'Unpin post' : 'Pin post',
        run: () => void run('pin', { postId: post.id, pinned: !post.is_pinned }),
      });
    if (leader || post.author_id === user?.id)
      options.push({
        label: 'Delete post',
        destructive: true,
        run: () =>
          Alert.alert('Delete this post?', 'This also removes its replies.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void run('delete_post', { postId: post.id }),
            },
          ]),
      });
    options.push({
      label: 'Report post',
      run: () =>
        setMenu({
          title: 'Report post',
          options: [
            'Spam or misleading content',
            'Harassment or abuse',
            'Unsafe or inappropriate content',
          ].map((reason) => ({
            label: reason,
            run: () => void run('report', { targetId: post.id, kind: 'post', reason }),
          })),
        }),
    });
    setMenu({ title: 'Post options', options });
  };
  const openMenu = () => {
    const options: CommunityActionOption[] = [];
    if (active || role === 'staff')
      options.push({
        label: leader ? 'Manage community' : 'Members',
        run: () => setManaging(true),
      });
    if (community?.privacy !== 'invite')
      options.push({
        label: 'Share community',
        run: () => {
          void Share.share({
            message: `Join ${community?.name} on YRDLY: https://app.yrdly.ng/communities/${id}`,
          }).catch(() => {});
        },
      });
    if (active)
      options.push({
        label: 'Leave community',
        destructive: true,
        run: () => {
          if (role === 'owner') {
            Alert.alert(
              'Transfer ownership first',
              'Offer ownership to another active member in Manage community. You can leave after they accept.'
            );
            setManaging(true);
            return;
          }
          Alert.alert(
            'Leave community?',
            'Your existing contributions will remain. You can rejoin under the community’s admission rules.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => void run('leave') },
            ]
          );
        },
      });
    setMenu({ title: community?.name || 'Community', options });
  };
  const more = async () => {
    if (!hasMore || loadingMore || !user || !active) return;
    setLoadingMore(true);
    const started = revision.current;
    try {
      const next = await CommunityService.fetchPosts(id, page.current + 1);
      const liked = next.length
        ? await supabase
            .from('community_post_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in(
              'post_id',
              next.map((post) => post.id)
            )
        : { data: [], error: null };
      if (liked.error) throw liked.error;
      if (started !== revision.current) return;
      const ids = new Set((liked.data || []).map((row) => row.post_id));
      setPosts((current) =>
        Array.from(
          new Map(
            [...current, ...next.map((post) => ({ ...post, liked_by_me: ids.has(post.id) }))].map(
              (post) => [post.id, post]
            )
          ).values()
        )
      );
      page.current++;
      setHasMore(next.length === 20);
    } catch (e: any) {
      setError(e.message || 'Could not load more posts.');
    } finally {
      setLoadingMore(false);
    }
  };
  const button = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={{
        padding: 13,
        backgroundColor: theme.colors.SURFACE,
        borderRadius: 12,
        marginVertical: 5,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <Text style={{ color: theme.colors.G, textAlign: 'center', fontFamily: 'Inter-SemiBold' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
  const cooldown =
    request?.status === 'rejected' &&
    !!request.reviewed_at &&
    Date.now() - new Date(request.reviewed_at).getTime() < 7 * 86400000;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: theme.colors.GLASS_BORDER,
        }}
      >
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        {community?.avatar_url && (
          <Image
            source={{ uri: community.avatar_url }}
            style={{ width: 38, height: 38, borderRadius: 19 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'Inter-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY }}
          >
            {community?.name || 'Community'}
          </Text>
          {community && (
            <Text style={{ color: theme.colors.LABEL }}>{community.member_count} members</Text>
          )}
        </View>
        {active && (
          <TouchableOpacity
            disabled={busy}
            accessibilityLabel={membership?.is_muted ? 'Unmute community' : 'Mute community'}
            onPress={() => void run('mute', { muted: !membership?.is_muted })}
          >
            {membership?.is_muted ? (
              <BellSlash size={22} color={theme.colors.LABEL} />
            ) : (
              <Bell size={22} color={theme.colors.LABEL} />
            )}
          </TouchableOpacity>
        )}
        {community && (
          <TouchableOpacity accessibilityLabel="Community options" onPress={openMenu}>
            <DotsThree size={26} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={theme.colors.G} />
      ) : (
        <FlatList
          data={active ? posts : []}
          keyExtractor={(post) => post.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.G}
            />
          }
          onEndReached={() => void more()}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View>
              {!!error && (
                <View>
                  <Text accessibilityRole="alert" style={{ color: '#ef4444' }}>
                    {error}
                  </Text>
                  {button('Try again', () => void load())}
                </View>
              )}
              {!community && !error && (
                <Text style={{ color: theme.colors.LABEL }}>
                  This community is unavailable, or your invitation has expired.
                </Text>
              )}
              {community?.banner_url && (
                <Image
                  source={{ uri: community.banner_url }}
                  style={{ height: 140, borderRadius: 14, marginBottom: 14 }}
                  contentFit="cover"
                />
              )}
              {!!community?.description && (
                <Text style={{ color: theme.colors.TEXT_PRIMARY, marginBottom: 12 }}>
                  {community.description}
                </Text>
              )}
              {!!community?.rules?.length && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }}>
                    Community rules
                  </Text>
                  {community.rules.map((rule, index) => (
                    <Text key={index} style={{ color: theme.colors.LABEL, marginTop: 5 }}>
                      {index + 1}. {rule}
                    </Text>
                  ))}
                </View>
              )}
              {!!offer && (
                <View>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
                    {offer.recipient_id === user?.id
                      ? 'You have been offered ownership. Accepting makes you responsible for this community.'
                      : 'Ownership offer awaiting acceptance.'}
                  </Text>
                  {offer.recipient_id === user?.id ? (
                    <View>
                      {button('Accept ownership', () => void run('accept_ownership'))}
                      {button('Decline ownership', () => void run('decline_ownership'))}
                    </View>
                  ) : (
                    button('Cancel ownership offer', () => void run('cancel_ownership'))
                  )}
                </View>
              )}
              {community && !active && (
                <View>
                  {membership?.status === 'banned' ? (
                    <Text style={{ color: '#ef4444' }}>
                      You are banned from this community. A community leader must lift the ban
                      before you can join.
                    </Text>
                  ) : invite ? (
                    <View>
                      <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
                        You have been invited. Join to see the community’s posts.
                      </Text>
                      {button('Accept invitation', () => void run('accept_invite'))}
                      {button('Decline invitation', () => void run('decline_invite'))}
                    </View>
                  ) : community.privacy === 'open' ? (
                    button('Join community', () => void run('join'))
                  ) : community.privacy === 'request' ? (
                    request?.status === 'pending' ? (
                      <View>
                        <Text style={{ color: theme.colors.LABEL }}>
                          Your join request is awaiting review.
                        </Text>
                        {button('Withdraw request', () => void run('withdraw'))}
                      </View>
                    ) : (
                      <View>
                        {cooldown && (
                          <Text style={{ color: theme.colors.LABEL }}>
                            Your request was declined. You can reapply seven days after the
                            decision.
                          </Text>
                        )}
                        {button('Request to join', () => void run('request'), !!cooldown)}
                      </View>
                    )
                  ) : (
                    <Text style={{ color: theme.colors.LABEL }}>
                      An invitation is required to join.
                    </Text>
                  )}
                </View>
              )}
              {active &&
                button('Write a post', () => {
                  setEditing(undefined);
                  setComposing(true);
                })}
            </View>
          }
          ListEmptyComponent={
            active ? (
              <Text style={{ color: theme.colors.LABEL, textAlign: 'center', padding: 30 }}>
                No posts yet. Share something with your community.
              </Text>
            ) : null
          }
          renderItem={({ item: post }) => (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: theme.colors.SURFACE,
                marginVertical: 6,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => router.push(`/profile/${post.author_id}` as any)}>
                  <Image
                    source={{ uri: post.author?.avatar_url || post.author_image || undefined }}
                    style={{ width: 38, height: 38, borderRadius: 19 }}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text
                      style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}
                    >
                      {post.author?.name || post.author_name || 'Member'}
                    </Text>
                    {post.author?.phone_verified && <VerifiedBadge size={15} />}
                  </View>
                  <Text style={{ color: theme.colors.LABEL, fontSize: 12 }}>
                    {timeAgo(post.created_at)}
                    {post.is_edited ? ' · edited' : ''}
                    {post.is_pinned ? ' · Pinned' : ''}
                    {post.is_announcement ? ' · Announcement' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Post options"
                  onPress={() => postActions(post)}
                >
                  <DotsThree color={theme.colors.LABEL} size={24} />
                </TouchableOpacity>
              </View>
              {post.moderation_status !== 'approved' && (
                <Text
                  style={{ color: post.moderation_status === 'rejected' ? '#ef4444' : '#e8b54a' }}
                >
                  {post.moderation_status === 'rejected'
                    ? 'Not published · rejected'
                    : 'Only you can see this · awaiting review'}
                </Text>
              )}
              <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 15, lineHeight: 22 }}>
                {post.content}
              </Text>
              <CommunityRevisionNotice item={post} />
              <CommunityMedia images={post.resolved_image_urls} videos={post.resolved_video_urls} />
              <View style={{ flexDirection: 'row', gap: 25 }}>
                <TouchableOpacity
                  accessibilityLabel={post.liked_by_me ? 'Unlike post' : 'Like post'}
                  disabled={post.moderation_status !== 'approved'}
                  onPress={() => void like(post)}
                  style={{ flexDirection: 'row', gap: 6 }}
                >
                  <Heart
                    size={21}
                    color={post.liked_by_me ? '#e5363d' : theme.colors.LABEL}
                    weight={post.liked_by_me ? 'fill' : 'regular'}
                  />
                  <Text style={{ color: theme.colors.LABEL }}>{post.like_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/communities/${id}/posts/${post.id}` as any)}
                  style={{ flexDirection: 'row', gap: 6 }}
                >
                  <ChatCircle size={21} color={theme.colors.LABEL} />
                  <Text style={{ color: theme.colors.LABEL }}>{post.comment_count} replies</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View>
              {loadingMore && <ActivityIndicator color={theme.colors.G} />}
              {!!areaPosts.length && (
                <Text style={{ color: theme.colors.LABEL, marginVertical: 14 }}>
                  More from the area
                </Text>
              )}
              {areaPosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  onPress={() =>
                    router.push(`/communities/${post.community_id}/posts/${post.id}` as any)
                  }
                  style={{
                    padding: 14,
                    marginBottom: 8,
                    backgroundColor: theme.colors.SURFACE,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{post.content}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      )}
      {busy && <ActivityIndicator color={theme.colors.G} />}
      {menu && <CommunityActions {...menu} onClose={() => setMenu(null)} />}
      {managing && community && (
        <CommunityManagement
          community={community}
          role={role}
          onClose={() => setManaging(false)}
          onChanged={() => void load()}
        />
      )}
      {composing && (
        <CommunityComposer
          communityId={id}
          post={editing}
          canAnnounce={['staff', 'owner', 'admin'].includes(role)}
          onClose={() => setComposing(false)}
          onSaved={() => void load()}
        />
      )}
    </SafeAreaView>
  );
}
