import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { ArrowLeft, DotsThree } from 'phosphor-react-native';
import { supabase } from '@/lib/supabase/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import {
  CommunityService,
  CommunityPost,
  CommunityComment,
} from '@/lib/communities/community-service';
import { CommunityActions, CommunityActionOption } from '@/components/communities/CommunityActions';
import { CommunityComposer } from '@/components/communities/CommunityComposer';
import { CommunityMedia, CommunityRevisionNotice } from '@/components/communities/CommunityMedia';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useNotificationRouteAcknowledgement } from '@/hooks/notifications/use-notification-route-ack';
import { timeAgo } from '@/lib/shared/utils';
import { Avatar } from '@/components/Avatar';
import { communityScreenStyles as s } from '@/components/communities/community-screen-styles';

export default function CommunityPostDetailScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { id, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const { user, profile } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const [leader, setLeader] = useState(false);
  const [editing, setEditing] = useState<CommunityComment | undefined>();
  const [composing, setComposing] = useState(false);
  const [menu, setMenu] = useState<{ title: string; options: CommunityActionOption[] } | null>(
    null
  );
  const revision = useRef(0);
  const loadedIdentity = useRef('');
  const inFlight = useRef(false);
  useNotificationRouteAcknowledgement(!loading && !!post && active);
  const load = useCallback(async () => {
    if (!user?.id || !id || !postId) return;
    const started = ++revision.current;
    setError('');
    try {
      const [item, replies, membership, community] = await Promise.all([
        CommunityService.getPost(id, postId),
        CommunityService.fetchComments(postId),
        CommunityService.getMyMembership(id, user.id),
        CommunityService.getCommunity(id),
      ]);
      const enriched = item;
      if (started !== revision.current) return;
      setPost(enriched);
      setComments(replies);
      setActive(membership?.status === 'active');
      setLeader(
        community?.owner_id === user.id ||
          !!profile?.is_admin ||
          ['admin', 'moderator'].includes(profile?.role || '') ||
          (membership?.status === 'active' && ['admin', 'moderator'].includes(membership.role))
      );
    } catch (e: any) {
      if (started === revision.current) setError(e.message || 'Could not load this post.');
    } finally {
      if (started === revision.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [id, postId, user?.id, profile?.is_admin, profile?.role]);
  useFocusEffect(
    useCallback(() => {
      const identity = `${id}:${postId}:${user?.id || ''}`;
      if (loadedIdentity.current !== identity) {
        loadedIdentity.current = identity;
        setLoading(true);
        setPost(null);
        setComments([]);
        setActive(false);
        setLeader(false);
        setComposing(false);
      }
      void load();
      const channel = supabase
        .channel(`community-replies-${postId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'community_comments',
            filter: `post_id=eq.${postId}`,
          },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'community_comments' },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'community_posts', filter: `id=eq.${postId}` },
          () => void load()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'community_memberships',
            filter: `community_id=eq.${id}`,
          },
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
    }, [id, postId, user?.id, load])
  );
  const run = async (action: string, data: Record<string, unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await CommunityService.command(id, action, data);
      await load();
    } catch (e: any) {
      Alert.alert('Could not complete action', e.message || 'Please try again.');
    } finally {
      inFlight.current = false;
    }
  };
  const commentActions = (comment: CommunityComment) => {
    const options: CommunityActionOption[] = [];
    if (comment.author_id === user?.id)
      options.push({
        label: 'Edit reply',
        run: () => {
          setEditing(comment);
          setComposing(true);
        },
      });
    if (comment.author_id === user?.id || leader)
      options.push({
        label: 'Delete reply',
        destructive: true,
        run: () =>
          Alert.alert('Delete reply?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void run('delete_comment', { commentId: comment.id }),
            },
          ]),
      });
    options.push({
      label: 'Report reply',
      run: () =>
        setMenu({
          title: 'Report reply',
          options: [
            'Spam or misleading content',
            'Harassment or abuse',
            'Unsafe or inappropriate content',
          ].map((reason) => ({
            label: reason,
            run: () => void run('report', { targetId: comment.id, kind: 'comment', reason }),
          })),
        }),
    });
    setMenu({ title: 'Reply options', options });
  };
  const button = (label: string, callback: () => void) => (
    <TouchableOpacity accessibilityRole="button" onPress={callback} style={s.button}>
      <Text style={s.buttonLabel}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={s.iconButton}
        >
          <ArrowLeft color={theme.colors.TEXT_PRIMARY} size={24} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={s.headerTitle}>Conversation</Text>
          <Text style={s.caption}>Post & replies</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.G} style={{ marginTop: 50 }} />
      ) : !post ? (
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 18 }}>
            {error
              ? 'Could not load this post'
              : active
                ? 'This post is no longer available'
                : 'Join the community to view this post'}
          </Text>
          <Text style={{ color: theme.colors.LABEL }}>
            {error || 'It may have been removed, or your membership no longer provides access.'}
          </Text>
          {error && button('Try again', () => void load())}
          {button('Go to community', () => router.replace(`/communities/${id}` as any))}
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(comment) => comment.id}
          contentContainerStyle={s.list}
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
          ListHeaderComponent={
            <View style={[s.overview, { marginBottom: 18 }]}>
              {!!error && <Text style={{ color: '#ef4444' }}>{error}</Text>}
              <View style={s.authorRow}>
                <Avatar
                  url={post.author?.avatar_url || post.author_image}
                  name={post.author?.name || post.author_name || 'Member'}
                  size={42}
                  style={s.avatar}
                />
                <View style={s.authorCopy}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={s.authorName}>
                      {post.author?.name || post.author_name || 'Member'}
                    </Text>
                    {post.author?.phone_verified && <VerifiedBadge size={16} />}
                  </View>
                  <Text style={s.caption}>
                    {timeAgo(post.created_at)}
                    {post.is_edited ? ' · Edited' : ''}
                  </Text>
                </View>
              </View>
              <Text style={s.body}>{post.content}</Text>
              <CommunityMedia images={post.resolved_image_urls} videos={post.resolved_video_urls} />
              <Text style={s.caption}>
                {post.comment_count} {post.comment_count === 1 ? 'reply' : 'replies'}
              </Text>
              {post.moderation_status !== 'approved' && (
                <Text style={{ color: '#e8b54a' }}>
                  This post is {post.moderation_status}. Replies become available after approval.
                </Text>
              )}
              {active &&
                post.moderation_status === 'approved' &&
                button('Write a reply', () => {
                  setEditing(undefined);
                  setComposing(true);
                })}
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                {error ? 'Replies couldn’t refresh' : 'Keep the conversation going'}
              </Text>
              <Text style={s.emptyBody}>
                {error
                  ? 'Pull down to try again.'
                  : 'No published replies yet. Be the first to add your thoughts.'}
              </Text>
            </View>
          }
          renderItem={({ item: comment }) => (
            <View style={s.post}>
              <View style={s.authorRow}>
                <Avatar
                  url={comment.author?.avatar_url || comment.author_image}
                  name={comment.author?.name || comment.author_name || 'Member'}
                  size={42}
                  style={s.avatar}
                />
                <View style={s.authorCopy}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={s.authorName}>
                      {comment.author?.name || comment.author_name || 'Member'}
                    </Text>
                    {comment.author?.phone_verified && <VerifiedBadge size={15} />}
                  </View>
                  <Text style={s.caption}>{timeAgo(comment.created_at)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => commentActions(comment)}
                  accessibilityLabel="Reply options"
                  accessibilityRole="button"
                  style={s.iconButton}
                >
                  <DotsThree size={24} color={theme.colors.LABEL} />
                </TouchableOpacity>
              </View>
              <Text style={s.body}>{comment.content}</Text>
              <CommunityRevisionNotice item={comment} />

              {comment.moderation_status !== 'approved' && (
                <Text
                  style={{
                    color: comment.moderation_status === 'rejected' ? '#ef4444' : '#e8b54a',
                  }}
                >
                  Only you can see this ·{' '}
                  {comment.moderation_status === 'rejected' ? 'rejected' : 'awaiting review'}
                </Text>
              )}
            </View>
          )}
        />
      )}
      {menu && <CommunityActions {...menu} onClose={() => setMenu(null)} />}
      {composing && (
        <CommunityComposer
          communityId={id}
          replyTo={postId}
          comment={editing}
          onClose={() => setComposing(false)}
          onSaved={() => void load()}
        />
      )}
    </SafeAreaView>
  );
}
