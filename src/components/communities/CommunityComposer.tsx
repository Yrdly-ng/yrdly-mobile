import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import ImagePicker from 'react-native-image-crop-picker';
import {
  CommunityService,
  CommunityPost,
  CommunityComment,
} from '@/lib/communities/community-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { MobileFile } from '@/lib/media/storage-service';

export function CommunityComposer({
  communityId,
  post,
  comment,
  replyTo,
  canAnnounce = false,
  onClose,
  onSaved,
}: {
  communityId: string;
  post?: CommunityPost;
  comment?: CommunityComment;
  replyTo?: string;
  canAnnounce?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const [text, setText] = useState(comment?.content || post?.content || '');
  const [files, setFiles] = useState<MobileFile[]>([]);
  const [keepImages, setKeepImages] = useState(post?.image_urls || []);
  const [keepVideos, setKeepVideos] = useState(post?.video_urls || []);
  const [announcement, setAnnouncement] = useState(post?.is_announcement || false);
  const [mentions, setMentions] = useState<string[]>(
    comment?.mentioned_user_ids || post?.mentioned_user_ids || []
  );
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const inFlight = useRef(false);
  const reply = !!replyTo || !!comment;
  useEffect(() => {
    if (!showMentions) return;
    let current = true;
    const timer = setTimeout(() => {
      CommunityService.members(communityId, query)
        .then((rows) => {
          if (current) setMembers(rows.filter((row) => row.status === 'active'));
        })
        .catch(() => {
          if (current) setMembers([]);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [communityId, query, showMentions]);
  const pick = async (kind: 'photo' | 'video') => {
    if (picking || busy) return;
    setPicking(true);
    try {
      const result = await ImagePicker.openPicker({
        mediaType: kind,
        multiple: true,
        maxFiles: kind === 'photo' ? 10 : 3,
        compressImageQuality: 0.85,
        compressImageMaxWidth: 2048,
        compressImageMaxHeight: 2048,
      });
      const chosen = (Array.isArray(result) ? result : [result]).map((asset) => ({
        uri: asset.path,
        name: asset.filename || `media-${Date.now()}`,
        type: asset.mime || 'image/jpeg',
        size: asset.size,
      }));
      const all = [...files, ...chosen];
      if (
        all.filter((file) => file.type.startsWith('image/')).length + keepImages.length > 10 ||
        all.filter((file) => file.type.startsWith('video/')).length + keepVideos.length > 3
      )
        throw new Error('Use up to 10 photos and 3 videos.');
      if (
        chosen.some((file) => file.size > (file.type.startsWith('video/') ? 40 : 10) * 1024 * 1024)
      )
        throw new Error('Photos must be under 10 MB and videos under 40 MB.');
      setFiles(all);
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED')
        Alert.alert('Could not add media', error.message || 'Please try again.');
    } finally {
      setPicking(false);
    }
  };
  const submit = async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({
          type: file.type,
          url: await CommunityService.uploadPostMedia(communityId, user.id, file),
        }))
      );
      if (reply)
        await CommunityService.createComment({
          communityId,
          postId: replyTo || comment!.post_id,
          commentId: comment?.id,
          authorId: user.id,
          authorName: '',
          content: text,
          mentions,
        });
      else
        await CommunityService.createPost({
          communityId,
          authorId: user.id,
          authorName: '',
          content: text,
          postId: post?.id,
          announcement,
          mentions,
          imageUrls: [
            ...keepImages,
            ...uploaded.filter((file) => file.type.startsWith('image/')).map((file) => file.url),
          ],
          videoUrls: [
            ...keepVideos,
            ...uploaded.filter((file) => file.type.startsWith('video/')).map((file) => file.url),
          ],
        });
      onSaved();
      onClose();
    } catch (error: any) {
      Alert.alert('Could not submit', error.message || 'Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const labelStyle = { color: theme.colors.TEXT_PRIMARY, fontSize: 15, marginVertical: 8 };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ ...labelStyle, fontSize: 22, fontFamily: 'Inter-Bold' }}>
                {post || comment ? 'Edit' : reply ? 'New reply' : 'New post'}
              </Text>
              <TouchableOpacity disabled={busy} onPress={onClose}>
                <Text style={{ color: theme.colors.G }}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.colors.LABEL }}>
              Safe content publishes after review. You can track pending submissions in the
              community. Videos may need a moderator’s review.
            </Text>
            <TextInput
              accessibilityLabel={reply ? 'Reply text' : 'Post text'}
              multiline
              value={text}
              onChangeText={setText}
              maxLength={reply ? 500 : 1000}
              editable={!busy}
              placeholder="Share with your community…"
              placeholderTextColor={theme.colors.LABEL}
              style={{
                color: theme.colors.TEXT_PRIMARY,
                backgroundColor: theme.colors.SURFACE,
                padding: 14,
                minHeight: 150,
                borderRadius: 14,
                textAlignVertical: 'top',
              }}
            />
            {!reply && (
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <TouchableOpacity disabled={busy || picking} onPress={() => pick('photo')}>
                  <Text style={{ color: theme.colors.G }}>Add photos</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy || picking} onPress={() => pick('video')}>
                  <Text style={{ color: theme.colors.G }}>Add videos</Text>
                </TouchableOpacity>
              </View>
            )}
            {picking && <ActivityIndicator color={theme.colors.G} />}
            {keepImages.map((url, index) => (
              <TouchableOpacity
                key={url}
                disabled={busy}
                onPress={() => setKeepImages(keepImages.filter((_, i) => i !== index))}
              >
                <Text style={labelStyle}>Photo {index + 1} · Remove</Text>
              </TouchableOpacity>
            ))}
            {keepVideos.map((url, index) => (
              <TouchableOpacity
                key={url}
                disabled={busy}
                onPress={() => setKeepVideos(keepVideos.filter((_, i) => i !== index))}
              >
                <Text style={labelStyle}>Video {index + 1} · Remove</Text>
              </TouchableOpacity>
            ))}
            {files.map((file, index) => (
              <TouchableOpacity
                key={`${file.uri}-${index}`}
                disabled={busy}
                onPress={() => setFiles(files.filter((_, i) => i !== index))}
              >
                <Text style={labelStyle}>
                  {file.type.startsWith('video/') ? 'Video' : 'Photo'} {index + 1} · Remove
                </Text>
              </TouchableOpacity>
            ))}
            {!reply && canAnnounce && (
              <TouchableOpacity
                disabled={busy}
                onPress={() => setAnnouncement(!announcement)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: announcement }}
              >
                <Text style={labelStyle}>
                  {announcement ? '☑' : '☐'} Publish as an announcement
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowMentions(!showMentions)}>
              <Text style={{ color: theme.colors.G }}>Mention members ({mentions.length})</Text>
            </TouchableOpacity>
            {showMentions && (
              <View>
                <TextInput
                  accessibilityLabel="Find members to mention"
                  value={query}
                  onChangeText={setQuery}
                  style={{ ...labelStyle, padding: 10, backgroundColor: theme.colors.SURFACE }}
                />
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => {
                      setMentions(
                        mentions.includes(member.user_id)
                          ? mentions.filter((id) => id !== member.user_id)
                          : [...mentions, member.user_id]
                      );
                    }}
                    style={{ padding: 12 }}
                  >
                    <Text style={labelStyle}>
                      {mentions.includes(member.user_id) ? '☑' : '☐'}{' '}
                      {member.user?.name || 'Member'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={
                busy ||
                picking ||
                (!text.trim() && !files.length && !keepImages.length && !keepVideos.length)
              }
              onPress={submit}
              style={{
                backgroundColor: theme.colors.G,
                padding: 16,
                borderRadius: 14,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={{ color: '#111', textAlign: 'center', fontFamily: 'Inter-Bold' }}>
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
