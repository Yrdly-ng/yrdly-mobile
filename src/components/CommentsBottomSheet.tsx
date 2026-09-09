import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';
import { timeAgo } from '../lib/utils';
import { Post } from '../types';
import { StorageService } from '../lib/storage-service';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { ModerationService } from '@/lib/moderation-service';

export interface CommentsBottomSheetProps {
  postId: string | null;
  onCommentAdded?: () => void;
}

export type CommentsBottomSheetRef = {
  present: () => void;
  dismiss: () => void;
};

import { CommentItem, CommentType } from './CommentItem';
import { CommentInput, CommentInputRef } from './CommentInput';

export const CommentsBottomSheet = forwardRef<CommentsBottomSheetRef, CommentsBottomSheetProps>(
  ({ postId, onCommentAdded }, ref) => {
    const { styles: stylesheet, theme } = useStyles(_stylesheet);

    const router = useRouter();
    const { user, profile } = useAuth();
    const insets = useSafeAreaInsets();

    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['60%', '100%'], []);

    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<CommentType[]>([]);
    const [loading, setLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);

    useImperativeHandle(ref, () => ({
      present: () => bottomSheetModalRef.current?.present(),
      dismiss: () => bottomSheetModalRef.current?.dismiss(),
    }));

    const inputRef = useRef<CommentInputRef>(null);

    const handleReply = useCallback((item: CommentType) => {
      const username = item.user?.name || item.author_name;
      const parentId = item.parent_id || item.id;
      if (username) {
        setReplyingTo({ id: parentId, name: username });
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }, []);

    const handleDeleteComment = useCallback(
      async (item: CommentType) => {
        if (!postId) return;
        try {
          const { error } = await supabase.from('comments').delete().eq('id', item.id);
          if (error) throw error;
          setComments((prev) => prev.filter((c) => c.id !== item.id));
          if (post) {
            const newCount = Math.max((post.comment_count || 1) - 1, 0);
            await supabase.from('posts').update({ comment_count: newCount }).eq('id', postId);
            setPost((prev) => (prev ? { ...prev, comment_count: newCount } : null));
            DeviceEventEmitter.emit('post_updated', {
              postId,
              updates: { comment_count: newCount },
            });
          }
        } catch (e) {
          console.error('Delete comment error:', e);
        }
      },
      [post, postId]
    );

    const userAvatarSource = useMemo(() => {
      if (profile?.avatar_url) {
        return StorageService.getOptimizedImageUrl(profile.avatar_url, 100) || profile.avatar_url;
      }
      if (user?.user_metadata?.avatar_url) {
        return (
          StorageService.getOptimizedImageUrl(user.user_metadata.avatar_url, 100) ||
          user.user_metadata.avatar_url
        );
      }
      return '';
    }, [profile?.avatar_url, user?.user_metadata?.avatar_url]);

    const fetchPost = useCallback(async () => {
      if (!postId) return;
      const { data, error } = await supabase
        .from('posts')
        .select('*, user:users!posts_user_id_fkey(id, name, avatar_url, location, created_at)')
        .eq('id', postId)
        .single();

      if (!error && data) {
        setPost(data);
      }
    }, [postId]);

    const fetchComments = useCallback(async () => {
      if (!postId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*, user:users!comments_user_id_fkey(name, avatar_url, phone_verified)')
        .eq('post_id', postId)
        .order('timestamp', { ascending: true });

      if (!error && data) {
        if (user?.id) {
          const commentIds = data.map((c) => c.id);
          const { data: likesData } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', commentIds);

          const likedSet = new Set(likesData?.map((l) => l.comment_id) || []);
          const enriched = data.map((c) => ({ ...c, is_liked: likedSet.has(c.id) }));
          setComments(enriched);
        } else {
          setComments(data);
        }
      }
      setLoading(false);
    }, [postId, user?.id]);

    useEffect(() => {
      if (!postId) {
        setComments([]);
        setPost(null);
        return;
      }
      fetchPost();
      fetchComments();

      // Realtime comments
      const ch = supabase
        .channel(`comments-${postId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'comments',
            filter: `post_id=eq.${postId}`,
          },
          (payload) => {
            setComments((prev) => {
              // Check if it already exists (optimistic update prevention)
              if (prev.find((c) => c.id === payload.new.id)) return prev;
              return [...prev, payload.new as CommentType];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ch);
      };
    }, [postId, fetchPost, fetchComments]);

    const handleSendComment = async (text: string, parentId?: string) => {
      if (!text.trim() || !user || !postId) return;

      try {
        const textMod = await ModerationService.checkText(text.trim());
        if (!textMod.isSafe) {
          Alert.alert('Content Flagged', 'Your comment contains inappropriate language.');
          throw new Error('Content flagged');
        }

        const payload = {
          post_id: postId,
          user_id: user.id,
          author_name: profile?.name || user.user_metadata?.name || user.email || 'Anonymous',
          author_image: profile?.avatar_url || user.user_metadata?.avatar_url || null,
          text: text.trim(),
          timestamp: new Date().toISOString(),
          like_count: 0,
          parent_id: parentId || null,
        };

        const { error } = await supabase.from('comments').insert(payload);
        if (error) throw error;

        // Update post comment count
        if (post) {
          const newCount = (post.comment_count || 0) + 1;
          await supabase.from('posts').update({ comment_count: newCount }).eq('id', postId);
          setPost({ ...post, comment_count: newCount });
          DeviceEventEmitter.emit('post_updated', {
            postId,
            updates: { comment_count: newCount },
          });
        }

        // Trigger notification
        const { NotificationTriggers } = await import('../lib/notification-triggers');
        await NotificationTriggers.onPostCommented(postId, user.id, text.trim());

        onCommentAdded?.();
      } catch (e) {
        console.error('Post comment error:', e);
        throw e;
      }
    };

    const handleLikeComment = useCallback(
      async (item: CommentType) => {
        if (!user) return;
        const isLiked = item.is_liked;
        const newCount = Math.max(0, (item.like_count || 0) + (isLiked ? -1 : 1));

        setComments((prev) =>
          prev.map((c) => {
            if (c.id === item.id) {
              return { ...c, is_liked: !isLiked, like_count: newCount };
            }
            return c;
          })
        );

        try {
          if (isLiked) {
            await supabase
              .from('comment_likes')
              .delete()
              .match({ comment_id: item.id, user_id: user.id });
          } else {
            await supabase.from('comment_likes').insert({ comment_id: item.id, user_id: user.id });
          }
          await supabase.from('comments').update({ like_count: newCount }).eq('id', item.id);
        } catch (e) {
          console.error('Like error:', e);
        }
      },
      [user]
    );

    const commentTree = useMemo(() => {
      const rootComments = comments.filter((c) => !c.parent_id);
      return rootComments.map((root) => ({
        ...root,
        replies: comments.filter((c) => c.parent_id === root.id),
      }));
    }, [comments]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      []
    );

    const handlePressProfile = useCallback(
      (userId: string) => {
        bottomSheetModalRef.current?.dismiss();
        router.push(`/profile/${userId}` as any);
      },
      [router]
    );

    const renderComment = useCallback(
      ({ item }: { item: CommentType }) => {
        return (
          <CommentItem
            item={item}
            currentUserId={user?.id}
            onReply={handleReply}
            onLike={handleLikeComment}
            onDelete={handleDeleteComment}
            onPressProfile={handlePressProfile}
          />
        );
      },
      [handleReply, handleLikeComment, handleDeleteComment, handlePressProfile, user?.id]
    );

    const renderFooter = useCallback(
      (props: any) => {
        const { styles: stylesheet, theme } = useStyles(_stylesheet);
        return (
          <BottomSheetFooter {...props} bottomInset={0}>
            <View style={{ overflow: 'hidden' }}>
              {isLiquidGlassSupported ? (
                <LiquidGlassView
                  {...({
                    intensity: 80,
                    tint: theme.colors.DARK === '#050505' ? 'dark' : 'light',
                    fallbackColor:
                      theme.colors.DARK === '#050505'
                        ? 'rgba(0,0,0,0.85)'
                        : 'rgba(255,255,255,0.85)',
                  } as any)}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor:
                        theme.colors.DARK === '#050505'
                          ? 'rgba(0,0,0,0.85)'
                          : 'rgba(255,255,255,0.85)',
                    },
                  ]}
                />
              )}
              <CommentInput
                ref={inputRef}
                userAvatarSource={userAvatarSource}
                userInitial={(profile?.name || user?.user_metadata?.name || user?.email || '?')
                  .charAt(0)
                  .toUpperCase()}
                replyingTo={replyingTo}
                onClearReply={() => setReplyingTo(null)}
                onSubmit={handleSendComment}
                InputComponent={BottomSheetTextInput}
              />
            </View>
          </BottomSheetFooter>
        );
      },
      [userAvatarSource, user, replyingTo, handleSendComment, theme.colors.DARK]
    );

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={{ backgroundColor: theme.colors.DARK }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.GLASS_BORDER }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize"
      >
        <LiquidGlassView
          {...({
            intensity: 80,
            tint: theme.colors.DARK === '#050505' ? 'dark' : 'light',
            fallbackColor:
              theme.colors.DARK === '#050505' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
          } as any)}
        >
          <View style={stylesheet.header}>
            <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              Comments
            </Text>
            <View
              style={[stylesheet.headerDivider, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
          </View>
        </LiquidGlassView>

        {loading && comments.length === 0 ? (
          <View style={stylesheet.center}>
            <ActivityIndicator size="small" color={theme.colors.G} />
          </View>
        ) : (
          <BottomSheetFlatList
            data={commentTree}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={stylesheet.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={stylesheet.emptyContainer}>
                <Text style={[stylesheet.emptyText, { color: theme.colors.TEXT_PRIMARY }]}>
                  No comments yet.
                </Text>
                <Text style={[stylesheet.emptyText, { color: theme.colors.MUTED }]}>
                  Start the conversation.
                </Text>
              </View>
            }
          />
        )}
      </BottomSheetModal>
    );
  }
);

const _stylesheet = createStyleSheet((theme) => ({
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  headerDivider: {
    width: '100%',
    height: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },

  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Outfit',
    fontWeight: 'bold',
    marginBottom: 4,
    color: theme.colors.TEXT_PRIMARY,
  },
}));
