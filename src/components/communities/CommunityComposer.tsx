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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import ImagePicker from 'react-native-image-crop-picker';
import {
  CommunityService,
  CommunityPost,
  CommunityComment,
} from '@/lib/communities/community-service';
import { useAuth } from '@/hooks/use-supabase-auth';
import { MobileFile } from '@/lib/media/storage-service';
import { ImageSquare, VideoCamera, At, X } from 'phosphor-react-native';
import { Avatar } from '@/components/Avatar';
import { communityScreenStyles as s } from './community-screen-styles';

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
  const { user, profile } = useAuth();
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
  const labelStyle = {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 21,
  };
  const submitDisabled =
    busy || picking || (!text.trim() && !files.length && !keepImages.length && !keepVideos.length);
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={['top', 'bottom']}
          style={{ flex: 1, backgroundColor: theme.colors.DARK }}
        >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.managementHeader}>
            <View style={s.headerCopy}>
              <Text style={s.managementTitle}>
                {post || comment
                  ? 'Edit your words'
                  : reply
                    ? 'Add a reply'
                    : 'Start a conversation'}
              </Text>
              <Text style={s.caption}>
                {reply
                  ? 'Keep the conversation going'
                  : 'A little thought can bring people together'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close composer"
              disabled={busy}
              onPress={onClose}
              style={s.iconButton}
            >
              <X size={22} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}
          >
            <View style={s.authorRow}>
              <Avatar
                url={profile?.avatar_url}
                name={profile?.name || 'You'}
                size={42}
                style={s.avatar}
              />
              <View style={s.authorCopy}>
                <Text style={s.authorName}>{profile?.name || 'You'}</Text>
                <Text style={s.caption}>Posting to your community</Text>
              </View>
            </View>
            <TextInput
              accessibilityLabel={reply ? 'Reply text' : 'Post text'}
              multiline
              value={text}
              onChangeText={setText}
              maxLength={reply ? 500 : 1000}
              editable={!busy}
              placeholder={
                reply ? 'Add your thoughts…' : 'Ask a question, share an idea or say hello…'
              }
              placeholderTextColor={theme.colors.LABEL}
              style={[
                s.input,
                {
                  minHeight: 190,
                  fontSize: 16,
                  lineHeight: 25,
                  textAlignVertical: 'top',
                  marginVertical: 0,
                },
              ]}
            />
            <Text style={[s.caption, { textAlign: 'right' }]}>
              {text.length} / {reply ? 500 : 1000}
            </Text>
            {!reply && (
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy || picking}
                  onPress={() => pick('photo')}
                  style={[s.button, s.postAction, { paddingHorizontal: 14 }]}
                >
                  <ImageSquare size={19} color={theme.colors.G} />
                  <Text style={s.buttonLabel}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy || picking}
                  onPress={() => pick('video')}
                  style={[s.button, s.postAction, { paddingHorizontal: 14 }]}
                >
                  <VideoCamera size={19} color={theme.colors.G} />
                  <Text style={s.buttonLabel}>Videos</Text>
                </TouchableOpacity>
              </View>
            )}
            {picking && <ActivityIndicator color={theme.colors.G} />}
            {keepImages.map((url, index) => (
              <TouchableOpacity
                key={url}
                disabled={busy}
                accessibilityRole="button"
                style={s.button}
                onPress={() => setKeepImages(keepImages.filter((_, i) => i !== index))}
              >
                <Text style={labelStyle}>Photo {index + 1} · Remove</Text>
              </TouchableOpacity>
            ))}
            {keepVideos.map((url, index) => (
              <TouchableOpacity
                key={url}
                disabled={busy}
                accessibilityRole="button"
                style={s.button}
                onPress={() => setKeepVideos(keepVideos.filter((_, i) => i !== index))}
              >
                <Text style={labelStyle}>Video {index + 1} · Remove</Text>
              </TouchableOpacity>
            ))}
            {files.map((file, index) => (
              <TouchableOpacity
                key={`${file.uri}-${index}`}
                disabled={busy}
                accessibilityRole="button"
                style={s.button}
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
                style={s.button}
                accessibilityState={{ checked: announcement }}
              >
                <Text style={labelStyle}>
                  {announcement ? '☑' : '☐'} Publish as an announcement
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showMentions }}
              disabled={busy}
              onPress={() => setShowMentions(!showMentions)}
              style={[s.postAction, { gap: 8 }]}
            >
              <At size={19} color={theme.colors.G} />
              <Text style={s.buttonLabel}>
                Mention members{mentions.length ? ` · ${mentions.length} selected` : ''}
              </Text>
            </TouchableOpacity>
            {showMentions && (
              <View>
                <TextInput
                  accessibilityLabel="Find members to mention"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search members by name"
                  placeholderTextColor={theme.colors.LABEL}
                  style={s.input}
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
                    disabled={busy}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: mentions.includes(member.user_id) }}
                    style={[s.authorRow, { paddingVertical: 12, minHeight: 48 }]}
                  >
                    <Avatar
                      url={member.user?.avatar_url}
                      name={member.user?.name || 'Member'}
                      size={36}
                      style={{ width: 36, height: 36, borderRadius: 12 }}
                    />
                    <Text style={[labelStyle, { flex: 1 }]}>
                      {mentions.includes(member.user_id) ? '☑' : '☐'}{' '}
                      {member.user?.name || 'Member'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[s.overview, { marginBottom: 0 }]}>
              <Text style={s.caption}>
                Posts and replies are reviewed before publishing. You can track pending submissions
                in the community. Videos may need a moderator’s review.
              </Text>
            </View>
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 16,
              borderTopWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: submitDisabled, busy }}
              disabled={submitDisabled}
              onPress={submit}
              style={{
                backgroundColor: theme.colors.G,
                minHeight: 52,
                padding: 16,
                borderRadius: 16,
                opacity: submitDisabled ? 0.5 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#111" accessibilityLabel="Submitting your content" />
              ) : (
                <Text
                  style={{
                    color: '#111',
                    textAlign: 'center',
                    fontFamily: 'Inter-Bold',
                    fontSize: 15,
                  }}
                >
                  {post || comment ? 'Save changes' : reply ? 'Submit reply' : 'Submit post'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
