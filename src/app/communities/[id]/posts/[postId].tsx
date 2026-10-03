import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, PaperPlaneTilt, Heart } from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { CommunityService, CommunityPost, CommunityComment } from '@/lib/community-service';
import { timeAgo } from '@/lib/utils';
import { useToast } from '@/components/toast';

function CommentRow({ comment }: { comment: CommunityComment }) {
  const { theme } = useUnistyles();
  return (
    <Animated.View entering={FadeIn} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
      {comment.author_image ? (
        <Image source={{ uri: comment.author_image }} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" />
      ) : (
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.G + '22', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.G, fontFamily: 'Inter-Bold', fontSize: 13 }}>
            {(comment.author_name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, backgroundColor: theme.colors.SURFACE, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER }}>
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY }}>
          {comment.author_name ?? 'User'}
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
            {'  '}{timeAgo(comment.created_at)}
          </Text>
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.TEXT_PRIMARY, marginTop: 4 }}>
          {comment.content}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function CommunityPostDetailScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const router = useRouter();
  const { id, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    const data = await CommunityService.fetchComments(postId).catch(() => []);
    setComments(data);
  }, [postId]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const { data } = await supabase
      .from('community_posts')
      .select('*, author:users!community_posts_author_id_fkey(id, name, avatar_url)')
      .eq('id', postId)
      .single();
    setPost(data as CommunityPost ?? null);
  }, [postId]);

  useEffect(() => {
    Promise.all([loadPost(), loadComments()]).then(() => setLoading(false));
  }, [loadPost, loadComments]);

  // Realtime comments
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`community-comments-${postId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_comments',
        filter: `post_id=eq.${postId}`,
      }, () => loadComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, loadComments]);

  const handleSend = async () => {
    if (!text.trim() || !user || !post || !id) return;
    setSending(true);
    try {
      const membership = await CommunityService.getMyMembership(id);
      await CommunityService.createComment({
        postId: post.id,
        communityId: id,
        authorId: user.id,
        authorName: profile?.name ?? 'User',
        authorImage: profile?.avatar_url ?? null,
        content: text.trim(),
        phoneVerified: (profile as any)?.phone_verified ?? false,
      });
      setText('');
    } catch (e: any) {
      showToast({ message: e.message ?? 'Could not send reply' });
    } finally {
      setSending(false);
    }
  };

  if (loading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.DARK }}>
        <ActivityIndicator color={theme.colors.G} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={[s.header, { backgroundColor: theme.colors.DARK, borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <ArrowLeft size={22} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Inter-Bold', fontSize: 17, color: theme.colors.TEXT_PRIMARY }}>Replies</Text>
      </SafeAreaView>

      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListHeaderComponent={
          <View style={[s.postHeader, { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER }]}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY, marginBottom: 2 }}>
              {post.author_name}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 15, color: theme.colors.TEXT_PRIMARY, lineHeight: 22 }}>
              {post.content}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL, marginTop: 8 }}>
              {post.like_count} likes · {post.comment_count} replies · {timeAgo(post.created_at)}
            </Text>
            <View style={{ height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginVertical: 12 }} />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: theme.colors.LABEL, fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', paddingTop: 24 }}>
            No replies yet. Be the first!
          </Text>
        }
        renderItem={({ item }) => <CommentRow comment={item} />}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom + 60}
      >
        <View style={[s.compose, {
          backgroundColor: theme.colors.GLASS_BG,
          borderTopColor: theme.colors.GLASS_BORDER,
          paddingBottom: insets.bottom + 8,
        }]}>
          <TextInput
            style={[s.input, {
              backgroundColor: theme.colors.SURFACE,
              color: theme.colors.TEXT_PRIMARY,
              fontFamily: 'Inter-Regular',
              borderColor: theme.colors.GLASS_BORDER,
            }]}
            placeholder="Write a reply…"
            placeholderTextColor={theme.colors.LABEL}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: text.trim() ? theme.colors.G : theme.colors.GLASS_BORDER }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator size={16} color="#fff" /> : <PaperPlaneTilt size={18} color="#fff" weight="fill" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  postHeader: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, maxHeight: 100, minHeight: 38 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
}));
