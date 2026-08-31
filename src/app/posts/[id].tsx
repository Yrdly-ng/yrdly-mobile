import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Keyboard,
  DeviceEventEmitter,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ModerationService } from '../../lib/moderation-service';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { usePosts } from '../../hooks/use-posts';
import { PostCard } from '../../components/PostCard';
import { Post } from '../../types';
import { timeAgo } from '../../lib/utils';

import { StorageService } from '../../lib/storage-service';
import { CommentItem, CommentType } from '../../components/CommentItem';
import { CommentInput, CommentInputRef } from '../../components/CommentInput';
import { ErrorBoundary } from '../../components/ErrorBoundary';

function PostDetailContent() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { id, focusComments } = useLocalSearchParams<{ id: string; focusComments?: string }>();
  const isFocused = useIsFocused();
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);

  const { deletePost } = usePosts();

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<CommentInputRef>(null);

  // iOS Keyboard Gap Fix
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const userAvatarSource = React.useMemo(() => {
    if (user?.user_metadata?.avatar_url) {
      return StorageService.getOptimizedImageUrl(user.user_metadata.avatar_url, 100) || '';
    }
    return '';
  }, [user?.user_metadata?.avatar_url]);

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
      if (!id) return;
      try {
        const { error } = await supabase.from('comments').delete().eq('id', item.id);
        if (error) throw error;
        setComments((prev) => prev.filter((c) => c.id !== item.id));
        if (post) {
          const newCount = Math.max((post.comment_count || 1) - 1, 0);
          await supabase.from('posts').update({ comment_count: newCount }).eq('id', id);
          setPost((prev) => (prev ? { ...prev, comment_count: newCount } : null));
        }
      } catch (e) {
        console.error('Delete comment error:', e);
      }
    },
    [post, id]
  );

  const fetchPost = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*, user:users!posts_user_id_fkey(id, name, avatar_url, location, created_at)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setPost(data);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('comments')
      .select('*, user:users!comments_user_id_fkey(name, avatar_url, phone_verified)')
      .eq('post_id', id)
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
        setComments(data.map((c) => ({ ...c, is_liked: likedSet.has(c.id) })));
      } else {
        setComments(data);
      }
    }
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    fetchPost();
    fetchComments();

    // Realtime comments
    const ch = supabase
      .channel(`comments-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${id}`,
        },
        (payload) => {
          setComments((prev) => [...prev, payload.new as CommentType]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchPost, fetchComments]);

  useEffect(() => {
    if (focusComments === 'true' && !loading && post && !hasAutoScrolled) {
      setHasAutoScrolled(true);
      setTimeout(() => {
        if (comments.length > 0) {
          try {
            flatListRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
          } catch (e) {
            // fallback if layout isn't fully ready
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        } else {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
        inputRef.current?.focus();
      }, 500);
    }
  }, [focusComments, loading, post, hasAutoScrolled, comments]);

  const handleSendComment = async (text: string, parentId?: string) => {
    if (!text.trim() || !user || !id) return;
    Keyboard.dismiss();

    try {
      const textMod = await ModerationService.checkText(text.trim());
      if (!textMod.isSafe) {
        Alert.alert('Content Flagged', 'Your comment contains inappropriate language.');
        return;
      }

      const payload = {
        post_id: id,
        user_id: user.id,
        author_name: user.user_metadata?.name || user.email || 'Anonymous',
        author_image: user.user_metadata?.avatar_url || null,
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
        await supabase.from('posts').update({ comment_count: newCount }).eq('id', id);
        setPost({ ...post, comment_count: newCount });
        DeviceEventEmitter.emit('post_updated', {
          postId: id,
          updates: { comment_count: newCount },
        });
      }

      // Trigger notification
      const { NotificationTriggers } = await import('../../lib/notification-triggers');
      await NotificationTriggers.onPostCommented(id, user.id, text.trim());

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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
        prev.map((c) => (c.id === item.id ? { ...c, is_liked: !isLiked, like_count: newCount } : c))
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
        console.error('Like comment error:', e);
      }
    },
    [user]
  );

  const commentTree = React.useMemo(() => {
    const rootComments = comments.filter((c) => !c.parent_id);
    return rootComments.map((root) => ({
      ...root,
      replies: comments.filter((c) => c.parent_id === root.id),
    }));
  }, [comments]);

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await deletePost(id);
              DeviceEventEmitter.emit('post_deleted', id);
              router.back();
            }
          },
        },
      ]
    );
  };

  const renderComment = useCallback(
    ({ item }: { item: CommentType }) => {
      return (
        <CommentItem
          item={item}
          currentUserId={user?.id}
          onReply={handleReply}
          onLike={handleLikeComment}
          onDelete={handleDeleteComment}
        />
      );
    },
    [handleReply, handleLikeComment, handleDeleteComment, user?.id]
  );

  return (
    <SafeAreaView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.GLASS_BORDER,
          backgroundColor: theme.colors.DARK,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.SURFACE_ALT,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: 'Outfit-Bold',
            fontWeight: '700',
            fontSize: 16,
            color: theme.colors.TEXT_PRIMARY,
          }}
        >
          Post
        </Text>

        {post?.user_id === user?.id ? (
          <TouchableOpacity
            onPress={handleDeletePost}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 61 : 0}>
        {loading && !post ? (
          <View style={stylesheet.center}>
            <ActivityIndicator size="large" color={theme.colors.G} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={commentTree}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            ListHeaderComponent={
              <View style={stylesheet.listHeader}>
                {post ? (
                  <PostCard post={post} isVisible={isFocused} />
                ) : (
                  <ActivityIndicator size="small" color={theme.colors.G} style={{ padding: 20 }} />
                )}
                <Text
                  style={[
                    stylesheet.commentsTitle,
                    { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' },
                  ]}
                >
                  Comments ({post?.comment_count || 0})
                </Text>
              </View>
            }
            contentContainerStyle={stylesheet.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={stylesheet.emptyContainer}>
                <Feather name="message-square" size={40} color={theme.colors.LABEL} />
                <Text
                  style={[stylesheet.emptyText, { color: theme.colors.MUTED, fontFamily: 'Inter' }]}
                >
                  No comments yet. Be the first!
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <CommentInput
          ref={inputRef}
          userAvatarSource={userAvatarSource}
          userInitial={(user?.user_metadata?.name || user?.email || '?').charAt(0).toUpperCase()}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          onSubmit={handleSendComment}
          InputComponent={TextInput}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, justifyContent: 'center', alignItems: 'flex-start' },
  deleteBtn: { width: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 20 },
  listHeader: { paddingBottom: 10 },
  divider: { height: 8, marginVertical: 10 },
  commentsTitle: { fontSize: 16, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 14, marginTop: 12 },
}));

export default function PostDetailScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  return (
    <ErrorBoundary screenName="PostDetail">
      <PostDetailContent />
    </ErrorBoundary>
  );
}
