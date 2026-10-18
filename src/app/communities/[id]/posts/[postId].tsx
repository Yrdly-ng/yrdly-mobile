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
import { Image } from 'expo-image';
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
      setLoading(true);
      setPost(null);
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
    }, [id, postId, load])
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
    <TouchableOpacity
      accessibilityRole="button"
      onPress={callback}
      style={{
        padding: 14,
        marginVertical: 8,
        backgroundColor: theme.colors.SURFACE,
        borderRadius: 12,
      }}
    >
      <Text style={{ color: theme.colors.G, textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' }}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()}>
          <ArrowLeft color={theme.colors.TEXT_PRIMARY} size={24} />
        </TouchableOpacity>
        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 20, fontFamily: 'Inter-Bold' }}>
          Community replies
        </Text>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
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
            <View style={{ paddingBottom: 18, gap: 10 }}>
              {!!error && <Text style={{ color: '#ef4444' }}>{error}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }}>
                  {post.author?.name || post.author_name}
                </Text>
                {post.author?.phone_verified && <VerifiedBadge size={16} />}
              </View>
              <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 16, lineHeight: 23 }}>
                {post.content}
              </Text>
              <CommunityMedia images={post.resolved_image_urls} videos={post.resolved_video_urls} />
              <Text style={{ color: theme.colors.LABEL }}>
                {post.comment_count} replies · {timeAgo(post.created_at)}
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
            <Text style={{ color: theme.colors.LABEL, textAlign: 'center', padding: 24 }}>
              No published replies yet.
            </Text>
          }
          renderItem={({ item: comment }) => (
            <View
              style={{
                padding: 14,
                backgroundColor: theme.colors.SURFACE,
                borderRadius: 12,
                marginBottom: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image
                  source={{ uri: comment.author?.avatar_url || comment.author_image || undefined }}
                  style={{ height: 32, width: 32, borderRadius: 16 }}
                />
                <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}>
                  {comment.author?.name || comment.author_name || 'Member'}
                </Text>
                {comment.author?.phone_verified && <VerifiedBadge size={15} />}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => commentActions(comment)}
                  accessibilityLabel="Reply options"
                >
                  <DotsThree size={24} color={theme.colors.LABEL} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: theme.colors.TEXT_PRIMARY }}>{comment.content}</Text>
              <CommunityRevisionNotice item={comment} />
              <Text style={{ color: theme.colors.LABEL, fontSize: 12 }}>
                {timeAgo(comment.created_at)}
              </Text>
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
