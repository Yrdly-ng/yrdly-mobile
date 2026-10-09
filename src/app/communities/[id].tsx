import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft, BellSlash, Bell, DotsThree, UsersThree, PaperPlaneTilt,
  Heart, ChatCircle, ImageSquare, Trash, Warning
} from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { CommunityService, Community, CommunityPost, CommunityMembership } from '@/lib/community-service';
import { StorageService } from '@/lib/storage-service';
import ImagePicker from 'react-native-image-crop-picker';
import { timeAgo } from '@/lib/utils';
import { useToast } from '@/components/toast';

// ─── Welcome empty state ──────────────────────────────────────────────────────
function EmptyFeed({ communityName }: { communityName: string }) {
  const { theme } = useUnistyles();
  return (
    <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 14 }}>
      <UsersThree size={56} color={theme.colors.G} weight="light" />
      <Text style={{ fontFamily: 'Inter-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY, textAlign: 'center' }}>
        Be the first to post here
      </Text>
      <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.LABEL, textAlign: 'center' }}>
        {communityName} is just getting started. Share something with your neighbours.
      </Text>
    </Animated.View>
  );
}

function ScrollableImages({ urls }: { urls: string[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
      {urls.slice(0, 4).map((url, i) => (
        <Image key={i} source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: 10 }} contentFit="cover" />
      ))}
    </View>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({
  post,
  userId,
  onLike,
  onComment,
  onDelete,
  communityId,
}: {
  post: CommunityPost;
  userId: string;
  onLike: (post: CommunityPost) => void;
  onComment: (post: CommunityPost) => void;
  onDelete?: (post: CommunityPost) => void;
  communityId: string;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const s = postCardStylesheet;

  return (
    <Animated.View entering={FadeIn} style={[s.card, { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER }]}>
      {/* Author row */}
      <TouchableOpacity
        style={s.authorRow}
        activeOpacity={0.8}
        onPress={() => router.push(`/profile/${post.author_id}` as any)}
      >
        {post.author?.avatar_url ? (
          <Image source={{ uri: post.author.avatar_url }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatarFallback, { backgroundColor: theme.colors.G + '22' }]}>
            <Text style={{ color: theme.colors.G, fontFamily: 'Inter-Bold', fontSize: 16 }}>
              {(post.author_name ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.authorName, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }]}>
            {post.author_name ?? 'User'}
          </Text>
          <Text style={[s.timestamp, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
            {timeAgo(post.created_at)}{post.is_edited ? ' · edited' : ''}
          </Text>
        </View>
        {post.is_pinned && (
          <View style={[s.pinnedBadge, { backgroundColor: theme.colors.G + '22' }]}>
            <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold', fontSize: 10 }}>📌 Pinned</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content */}
      <Text style={[s.content, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Regular' }]}>
        {post.content}
      </Text>

      {/* Images */}
      {post.image_urls?.length ? (
        <ScrollableImages urls={post.image_urls} />
      ) : null}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => onLike(post)}>
          <Heart
            size={20}
            color={post.liked_by_me ? '#E5363D' : theme.colors.LABEL}
            weight={post.liked_by_me ? 'fill' : 'regular'}
          />
          <Text style={[s.actionCount, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
            {post.like_count > 0 ? post.like_count : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onComment(post)}>
          <ChatCircle size={20} color={theme.colors.LABEL} />
          <Text style={[s.actionCount, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
            {post.comment_count > 0 ? post.comment_count : ''}
          </Text>
        </TouchableOpacity>
        {onDelete && post.author_id === userId && (
          <TouchableOpacity style={[s.actionBtn, { marginLeft: 'auto' }]} onPress={() => onDelete(post)}>
            <Trash size={18} color={theme.colors.LABEL} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}



const postCardStylesheet = StyleSheet.create((theme) => ({
  card: { marginHorizontal: 0, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 14 },
  timestamp: { fontSize: 12, marginTop: 1 },
  pinnedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  content: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13 },
}));

// ─── "More from LGA" section header ──────────────────────────────────────────
function LgaSection({ communityId, communityName }: { communityId: string; communityName: string }) {
  const { theme } = useUnistyles();
  const [lgaPosts, setLgaPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    CommunityService.fetchParentLgaPosts(communityId).then(setLgaPosts).catch(() => {});
  }, [communityId]);

  if (!lgaPosts.length) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
      <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.LABEL, marginBottom: 8 }}>
        More from the area
      </Text>
      {lgaPosts.map((p) => (
        <View key={p.id} style={{
          backgroundColor: theme.colors.SURFACE, borderRadius: 14,
          padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
          opacity: 0.85,
        }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.TEXT_PRIMARY }}>{p.content}</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL, marginTop: 6 }}>
            {p.author_name} · {timeAgo(p.created_at)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CommunityFeedScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [joinRequest, setJoinRequest] = useState<{ status: 'pending' | 'approved' | 'rejected' } | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSparse, setIsSparse] = useState(false);

  // Compose state
  const [composeText, setComposeText] = useState('');
  const [posting, setPosting] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const [comm, mem, request, postsData] = await Promise.all([
      CommunityService.getCommunity(id),
      CommunityService.getMyMembership(id, user.id),
      CommunityService.getMyJoinRequest(id, user.id),
      CommunityService.fetchPosts(id),
    ]);
    setCommunity(comm);
    setMembership(mem);
    setJoinRequest(request);
    // Attach liked_by_me
    if (postsData.length) {
      const { data: likedRows } = await supabase
        .from('community_post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postsData.map((p) => p.id));
      const likedSet = new Set((likedRows ?? []).map((r: any) => r.post_id));
      setPosts(postsData.map((p) => ({ ...p, liked_by_me: likedSet.has(p.id) })));
    } else {
      setPosts([]);
    }
    if (comm?.type === 'ward') {
      const sparse = await CommunityService.isWardSparse(id);
      setIsSparse(sparse);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  // Realtime: listen for new community_posts
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`community-feed-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_posts',
        filter: `community_id=eq.${id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleJoin = async () => {
    if (!user || !community || joining || joinRequest) return;
    setJoining(true);
    try {
      if (community.privacy === 'open') {
        await CommunityService.joinCommunity(community.id, user.id);
        showToast({ message: `Joined ${community.name}` });
      } else if (community.privacy === 'request') {
        await CommunityService.requestToJoin(community.id, user.id);
        setJoinRequest({ status: 'pending' });
        showToast({ message: 'Join request sent!' });
      }
      await load();
    } catch (e: any) {
      showToast({ message: e.message ?? 'Could not join community' });
    } finally {
      setJoining(false);
    }
  };

  const handlePost = async () => {
    if (!composeText.trim() || !user || !community || !membership) return;
    setPosting(true);
    try {
      await CommunityService.createPost({
        communityId: community.id,
        authorId: user.id,
        authorName: profile?.name ?? 'User',
        authorImage: profile?.avatar_url ?? null,
        content: composeText.trim(),
        phoneVerified: (profile as any)?.phone_verified ?? false,
        memberRole: membership.role,
      });
      setComposeText('');
      showToast({ message: 'Post submitted!' });
      load();
    } catch (e: any) {
      showToast({ message: e.message ?? 'Could not post' });
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (!user) return;
    const action = post.liked_by_me ? 'unlike' : 'like';
    // Optimistic
    setPosts((prev) => prev.map((p) =>
      p.id === post.id
        ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (post.liked_by_me ? -1 : 1) }
        : p
    ));
    await supabase.rpc('community_toggle_post_like', { p_post_id: post.id, p_user_id: user.id, p_action: action });
  };

  const handleDelete = (post: CommunityPost) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await CommunityService.deletePost(post.id);
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
        }
      },
    ]);
  };

  const toggleMute = async () => {
    if (!user || !community || !membership) return;
    await CommunityService.setMuted(community.id, user.id, !membership.is_muted);
    setMembership({ ...membership, is_muted: !membership.is_muted });
    showToast({ message: membership.is_muted ? 'Notifications on' : 'Notifications muted' });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.DARK }}>
        <ActivityIndicator color={theme.colors.G} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.DARK }}>
        <Warning size={48} color={theme.colors.LABEL} />
        <Text style={{ color: theme.colors.LABEL, fontFamily: 'Inter-Regular', marginTop: 12 }}>Community not found.</Text>
      </View>
    );
  }

  const isMember = membership?.status === 'active';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <SafeAreaView edges={['top']} style={[s.header, { backgroundColor: theme.colors.DARK, borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={[s.headerMeta, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
            {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
          </Text>
        </View>
        {isMember && (
          <TouchableOpacity style={s.muteBtn} onPress={toggleMute}>
            {membership?.is_muted
              ? <BellSlash size={20} color={theme.colors.LABEL} />
              : <Bell size={20} color={theme.colors.LABEL} />
            }
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Feed */}
      <FlatList
        data={isMember ? posts : []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: isMember ? 110 : 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.G} />}
        ListHeaderComponent={community.banner_url ? (
          <Image source={{ uri: community.banner_url }} style={s.banner} contentFit="cover" />
        ) : null}
        ListEmptyComponent={
          isMember
            ? <EmptyFeed communityName={community.name} />
            : (
              <View style={s.joinWrap}>
                <UsersThree size={52} color={theme.colors.G} weight="light" />
                <Text style={[s.joinTitle, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-Bold' }]}>
                  {community.privacy === 'invite' ? 'Invite Only' : `Join ${community.name}`}
                </Text>
                <Text style={[s.joinDesc, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}>
                  {community.description ?? 'Connect with your neighbours and stay in the loop.'}
                </Text>
                {community.privacy !== 'invite' && (
                  <TouchableOpacity
                    style={[s.joinBtn, { backgroundColor: theme.colors.G }]}
                    onPress={handleJoin}
                    disabled={joining || !!joinRequest}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'Inter-Bold', fontSize: 15 }}>
                      {joining ? 'Sending…' : community.privacy === 'open' ? 'Join Community' : joinRequest?.status === 'pending' ? 'Request Pending' : joinRequest?.status === 'rejected' ? 'Request Declined' : 'Request to Join'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            userId={user?.id ?? ''}
            onLike={handleLike}
            onComment={(p) => router.push(`/communities/${id}/posts/${p.id}` as any)}
            onDelete={handleDelete}
            communityId={community.id}
          />
        )}
        ListFooterComponent={isMember && isSparse && community.type === 'ward' ? (
          <LgaSection communityId={community.id} communityName={community.name} />
        ) : null}
      />

      {/* Compose bar */}
      {isMember && (
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
              style={[s.composeInput, {
                backgroundColor: theme.colors.SURFACE,
                color: theme.colors.TEXT_PRIMARY,
                fontFamily: 'Inter-Regular',
                borderColor: theme.colors.GLASS_BORDER,
              }]}
              placeholder={`Post to ${community.name}…`}
              placeholderTextColor={theme.colors.LABEL}
              value={composeText}
              onChangeText={setComposeText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: composeText.trim() ? theme.colors.G : theme.colors.GLASS_BORDER }]}
              onPress={handlePost}
              disabled={!composeText.trim() || posting}
            >
              {posting
                ? <ActivityIndicator size={18} color="#fff" />
                : <PaperPlaneTilt size={20} color="#fff" weight="fill" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 17 },
  headerMeta: { fontSize: 12 },
  muteBtn: { padding: 8 },
  banner: { width: '100%', height: 140, borderRadius: 16, marginBottom: 16 },
  joinWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 14 },
  joinTitle: { fontSize: 20, textAlign: 'center' },
  joinDesc: { fontSize: 14, textAlign: 'center' },
  joinBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1,
  },
  composeInput: {
    flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
    paddingVertical: 8, fontSize: 15, maxHeight: 100, minHeight: 40,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
}));
