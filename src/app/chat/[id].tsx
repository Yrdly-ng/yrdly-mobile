import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ImagePicker from 'react-native-image-crop-picker';
import { useIsFocused } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import ImageViewing from 'react-native-image-viewing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useAppTheme } from '../../context/ThemeContext';
import { formatPrice } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';

interface Message {
  id: string;
  sender_id: string;
  text?: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  is_read?: boolean;
  deleted_by?: string[];
}

interface ConversationMeta {
  id: string;
  type: 'friend' | 'marketplace' | 'briefcase' | 'event';
  participant_ids: string[];
  item_id?: string;
  item_title?: string;
  item_image?: string;
  item_price?: number;
  business_name?: string;
}

import { AppState } from 'react-native';

const ChatVideo = React.memo(
  ({
    url,
    width,
    height,
    borderRadius,
    marginBottom,
    isFocused,
  }: {
    url: string;
    width: number;
    height: number;
    borderRadius: number;
    marginBottom: number;
    isFocused: boolean;
  }) => {
    const player = useVideoPlayer(url, (player) => {
      player.loop = false;
    });

    useEffect(() => {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (player) {
          if (nextAppState !== 'active' || !isFocused) {
            player.pause();
          }
        }
      });

      return () => {
        subscription.remove();
      };
    }, [player, isFocused]);

    useEffect(() => {
      if (!isFocused && player) {
        player.pause();
      }
    }, [isFocused, player]);

    return (
      <VideoView
        style={{ width, height, borderRadius, marginBottom }}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
      />
    );
  }
);

function ChatContent() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { isDarkMode } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  // Extract stable primitive values once — avoids params object reference changing every render
  const paramType = params.type as string | undefined;
  const paramParticipantId = params.participant_id as string | undefined;
  const paramItemId = params.item_id as string | undefined;
  const paramItemTitle = params.item_title as string | undefined;
  const paramItemImage = params.item_image as string | undefined;
  const paramItemPrice = params.item_price as string | undefined;
  const { user, profile, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [otherUser, setOtherUser] = useState<{
    name: string;
    avatar_url: string | null;
    username?: string | null;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const formatChatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
      const year = date.getFullYear();
      if (year === today.getFullYear()) {
        return `${day} ${month}`;
      }
      return `${day} ${month} ${year}`;
    }
  };

  const messagesWithDates = React.useMemo(() => {
    const result = [];
    let prevDateStr = null;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const d = new Date(m.created_at);
      const dateStr = d.toDateString();

      if (dateStr !== prevDateStr) {
        result.push({
          isDateHeader: true,
          id: `date-${dateStr}`,
          dateText: formatChatDate(d),
        } as any);
        prevDateStr = dateStr;
      }

      result.push(m);
    }
    return result;
  }, [messages]);

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

  const fetchMeta = useCallback(async () => {
    if (!id || !user) return;
    if (id === 'new') {
      setMeta({
        id: 'new',
        type: paramType as any,
        participant_ids: [user.id, paramParticipantId as string],
        item_id: paramItemId as string,
        item_title: paramItemTitle as string,
        item_image: paramItemImage as string,
        item_price: paramItemPrice ? Number(paramItemPrice) : undefined,
      });
      if (paramParticipantId) {
        const { data: u } = await supabase
          .from('users')
          .select('name, avatar_url, username')
          .eq('id', paramParticipantId)
          .single();
        if (u) {
          setOtherUser(u);
          setAvatarError(false);
        }
      }
      setLoading(false);
      return;
    }

    const { data } = await supabase.from('conversations').select('*').eq('id', id).single();
    if (data) {
      setMeta(data);
      const otherId = data.participant_ids?.find((pid: string) => pid !== user.id);
      if (otherId) {
        const { data: u } = await supabase
          .from('users')
          .select('name, avatar_url, username')
          .eq('id', otherId)
          .single();
        if (u) {
          setOtherUser(u);
          setAvatarError(false);
        }
      }
    }
    setLoading(false);
  }, [
    id,
    user,
    paramType,
    paramParticipantId,
    paramItemId,
    paramItemTitle,
    paramItemImage,
    paramItemPrice,
  ]);

  const fetchMessages = useCallback(async () => {
    if (!id || id === 'new') {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);

      const unreadIds = data
        .filter((m: any) => !m.is_read && m.sender_id !== user?.id)
        .map((m: any) => m.id);

      if (unreadIds.length > 0) {
        supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds)
          .then(({ error }) => {
            if (error) console.error('MARK AS READ ERROR:', error);
          });
      }
    }
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    if (!id || id === 'new' || !user || !isFocused) return;
    supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'message')
      .eq('related_id', id)
      .then();
  }, [id, user, isFocused]);

  useEffect(() => {
    if (!meta || id === 'new') return;

    fetchMessages();

    // Realtime subscriptions for messages table
    const ch = supabase
      .channel(`chat-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as Message;
            if (
              prev.some(
                (m) =>
                  m.id === newMsg.id ||
                  (m.sender_id === newMsg.sender_id &&
                    m.text === newMsg.text &&
                    m.created_at === newMsg.created_at)
              )
            )
              return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

          // Mark as read if it's from the other user
          const newMsg = payload.new as Message;
          if (newMsg.sender_id !== user?.id && !newMsg.is_read) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
              .then(({ error }) => {
                if (error) console.error('MARK AS READ REALTIME ERROR:', error);
              });
            supabase
              .from('notifications')
              .delete()
              .eq('user_id', user?.id)
              .eq('type', 'message')
              .eq('related_id', id)
              .then();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, meta, fetchMessages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !id || sending) return;
    setSending(true);
    const body = inputText.trim();
    setInputText('');

    try {
      if (editingMessage) {
        let newText = body;
        if (!newText.endsWith('(Edited)')) {
          newText = newText + ' (Edited)';
        }
        const { error: editErr } = await supabase
          .from('messages')
          .update({ text: newText })
          .eq('id', editingMessage.id);

        if (editErr) {
          const msg = editErr.message?.includes('15 minutes')
            ? 'You can only edit messages within 15 minutes of sending.'
            : editErr.message?.includes('sender')
              ? 'You can only edit your own messages.'
              : 'Failed to edit message. Please try again.';
          Alert.alert('Cannot Edit', msg);
          setSending(false);
          return;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, text: newText } : m))
        );

        // Optimistically update conversation if this was the last message
        const isLatest =
          messages.length > 0 && messages[messages.length - 1].id === editingMessage.id;
        if (isLatest) {
          supabase.from('conversations').update({ last_message_text: newText }).eq('id', id).then();
        }

        setEditingMessage(null);
        setSending(false);
        return;
      }
      let currentConvId = id;
      if (id === 'new') {
        const { data: newConv, error: newError } = await supabase
          .from('conversations')
          .insert({
            type: paramType,
            participant_ids: [user.id, paramParticipantId],
            item_id: paramItemId || null,
            item_title: paramItemTitle || null,
            item_image: paramItemImage || null,
            item_price: paramItemPrice ? Number(paramItemPrice) : null,
            last_message_text: body,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (newError) throw newError;
        currentConvId = newConv.id;
      }

      const payload: Record<string, unknown> = {
        sender_id: user.id,
        created_at: new Date().toISOString(),
        text: body,
        conversation_id: currentConvId,
      };

      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;

      if (id !== 'new') {
        await supabase
          .from('conversations')
          .update({
            last_message_text: body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentConvId);
      }

      // Trigger notification
      const toUserId = meta?.participant_ids?.find((pid: string) => pid !== user.id);
      if (toUserId) {
        const { NotificationTriggers } = await import('../../lib/notification-triggers');
        await NotificationTriggers.onMessageSent(toUserId, user.id, currentConvId, body);
      }

      if (id === 'new') {
        router.replace({ pathname: '/chat/[id]', params: { id: currentConvId } });
        return;
      }

      // We append locally so it shows immediately
      if (data) {
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m.id === data.id ||
                (m.sender_id === data.sender_id &&
                  m.text === data.text &&
                  m.created_at === data.created_at)
            )
          )
            return prev;
          return [...prev, data as Message];
        });
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Send message error:', e);
      setInputText(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handlePickMedia = async (type: 'photo' | 'video') => {
    if (sending || uploadingMedia) return;
    try {
      const isPhoto = type === 'photo';
      const options: any = { mediaType: type };

      if (isPhoto) {
        options.cropping = true;
        options.freeStyleCropEnabled = true;
        options.compressImageQuality = 1;
        options.compressImageMaxWidth = 4096;
        options.compressImageMaxHeight = 4096;
      }

      const image = await ImagePicker.openPicker(options);

      if (image) {
        const selected = image as any;
        uploadAndSendMedia({
          uri: selected.path,
          type: selected.mime || (selected.path.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'),
        });
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection' && e.message !== 'User cancelled') {
        console.log('ImagePicker error:', e);
        Alert.alert('Error', e.message || 'Failed to pick media');
      }
    }
  };

  const pickMedia = () => {
    Alert.alert('Attach Media', 'Choose the type of media to upload', [
      { text: 'Photo', onPress: () => handlePickMedia('photo') },
      { text: 'Video', onPress: () => handlePickMedia('video') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAndSendMedia = async (asset: { uri: string; type?: string }) => {
    if (!user || !id) return;
    setUploadingMedia(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const isVideo = asset.type === 'video';
      const filename = `${user.id}/${Date.now()}.${ext}`;

      const bucketName = isVideo ? 'chat-videos' : 'chat-images';
      const mimeExt = ext === 'jpg' ? 'jpeg' : ext;

      let fileBody: ArrayBuffer | Blob;
      if (isVideo) {
        const response = await fetch(asset.uri);
        fileBody = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        fileBody = decode(base64);
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filename, fileBody, {
          contentType: isVideo ? `video/${mimeExt}` : `image/${mimeExt}`,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(filename);

      let currentConvId = id;
      const mediaText = isVideo ? 'Sent a video 📹' : 'Sent an image 📸';

      if (id === 'new') {
        const { type, participant_id, item_id, item_title, item_image, item_price } = params;
        const { data: newConv, error: newError } = await supabase
          .from('conversations')
          .insert({
            type,
            participant_ids: [user.id, participant_id],
            item_id: item_id || null,
            item_title: item_title || null,
            item_image: item_image || null,
            item_price: item_price ? Number(item_price) : null,
            last_message_text: mediaText,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (newError) throw newError;
        currentConvId = newConv.id;
      }

      const payload: Record<string, unknown> = {
        sender_id: user.id,
        created_at: new Date().toISOString(),
        text: '',
        conversation_id: currentConvId,
        media_url: publicUrl,
        media_type: isVideo ? 'video' : 'image',
      };

      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;

      if (id !== 'new') {
        await supabase
          .from('conversations')
          .update({
            last_message_text: mediaText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentConvId);
      }

      // Trigger notification
      const toUserId = meta?.participant_ids?.find((pid: string) => pid !== user.id);
      if (toUserId) {
        const { NotificationTriggers } = await import('../../lib/notification-triggers');
        await NotificationTriggers.onMessageSent(toUserId, user.id, currentConvId, mediaText);
      }

      if (id === 'new') {
        router.replace({ pathname: '/chat/[id]', params: { id: currentConvId } });
        return;
      }

      if (data) {
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m.id === data.id ||
                (m.sender_id === data.sender_id &&
                  m.created_at === data.created_at &&
                  m.media_url === data.media_url)
            )
          )
            return prev;
          return [...prev, data as Message];
        });
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Upload media error:', e);
    } finally {
      setUploadingMedia(false);
    }
  };

  const openViewer = (url: string) => {
    setViewerImages([{ uri: url }]);
    setViewerVisible(true);
  };

  const handleMessageLongPress = (item: Message) => {
    if (!user) return;

    const isMine = item.sender_id === user.id;
    const msgTime = new Date(item.created_at).getTime();
    const now = new Date().getTime();
    const diffMins = (now - msgTime) / (1000 * 60);
    const canDeleteForEveryone = isMine && diffMins <= 15;

    const options: import('react-native').AlertButton[] = [
      {
        text: 'Delete for me',
        style: 'destructive' as const,
        onPress: async () => {
          try {
            const newDeletedBy = [...(item.deleted_by || []), user.id];
            const { error: delMeErr } = await supabase
              .from('messages')
              .update({ deleted_by: newDeletedBy })
              .eq('id', item.id);

            if (delMeErr) {
              Alert.alert('Error', 'Failed to delete message. Please try again.');
              return;
            }

            setMessages((prev) => prev.filter((m) => m.id !== item.id));
          } catch (e) {
            console.error('Failed to delete message for me:', e);
          }
        },
      },
    ];

    if (canDeleteForEveryone) {
      options.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(item);
          setInputText((item.text || item.content || '').replace(' (Edited)', ''));
        },
      });
      options.push({
        text: 'Delete for everyone',
        style: 'destructive' as const,
        onPress: async () => {
          try {
            const { error: delErr } = await supabase
              .from('messages')
              .update({ text: 'This message was deleted', media_url: null, media_type: null })
              .eq('id', item.id);

            if (delErr) {
              const msg = delErr.message?.includes('15 minutes')
                ? 'You can only delete messages within 15 minutes of sending.'
                : delErr.message?.includes('sender')
                  ? 'You can only delete your own messages.'
                  : 'Failed to delete message. Please try again.';
              Alert.alert('Cannot Delete', msg);
              return;
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === item.id
                  ? {
                      ...m,
                      text: 'This message was deleted',
                      media_url: undefined,
                      media_type: undefined,
                    }
                  : m
              )
            );

            const isLatest = messages.length > 0 && messages[messages.length - 1].id === item.id;
            if (isLatest) {
              supabase
                .from('conversations')
                .update({ last_message_text: 'This message was deleted' })
                .eq('id', id)
                .then();
            }
          } catch (e) {
            console.error('Failed to delete message for everyone:', e);
          }
        },
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel' as const,
      onPress: () => {},
    });

    Alert.alert('Message Options', 'Choose an action for this message', options);
  };

  const renderMessage = ({ item }: { item: any }) => {
    if (item.isDateHeader) {
      return (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Text
            style={{
              color: theme.colors.MUTED,
              fontSize: 12,
              fontWeight: '500',
              fontFamily: 'Inter',
            }}
          >
            {item.dateText}
          </Text>
        </View>
      );
    }

    // Hide message if deleted by current user
    if (item.deleted_by?.includes(user?.id || '')) {
      return null;
    }

    const isMine = item.sender_id === user?.id;
    const msgText = item.text || item.content || '';
    const imgUrl = item.media_type === 'image' ? item.media_url : null;
    const vidUrl = item.media_type === 'video' ? item.media_url : null;
    const hasMedia = !!imgUrl || !!vidUrl;

    return (
      <View style={[stylesheet.msgRow, isMine ? stylesheet.msgRowRight : stylesheet.msgRowLeft]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => handleMessageLongPress(item)}
          style={[
            stylesheet.bubble,
            isMine ? stylesheet.bubbleMine : stylesheet.bubbleTheirs,
            isMine
              ? { backgroundColor: theme.colors.G, borderWidth: 0 }
              : {
                  backgroundColor: theme.colors.SURFACE,
                  borderWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                },
            hasMedia &&
              !msgText && {
                backgroundColor: 'transparent',
                paddingHorizontal: 0,
                paddingVertical: 0,
                paddingBottom: 0,
              },
            hasMedia && msgText && { paddingHorizontal: 4, paddingVertical: 4, paddingBottom: 6 },
          ]}
        >
          {imgUrl && (
            <TouchableOpacity
              onPress={() => openViewer(imgUrl)}
              onLongPress={() => handleMessageLongPress(item)}
            >
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: imgUrl }}
                  style={[
                    { width: 240, height: 300, borderRadius: 16, marginBottom: msgText ? 6 : 0 },
                    !isMine && !msgText && { backgroundColor: 'transparent' },
                  ]}
                  contentFit="contain"
                />
                {!msgText && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: theme.colors.TEXT_PRIMARY }}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          {vidUrl && (
            <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleMessageLongPress(item)}>
              <ChatVideo
                url={vidUrl}
                width={220}
                height={220}
                borderRadius={14}
                marginBottom={msgText ? 6 : 0}
                isFocused={isFocused}
              />
            </TouchableOpacity>
          )}
          {!!msgText && (
            <Text
              style={[
                stylesheet.bubbleText,
                {
                  color: isMine ? theme.colors.DARK : theme.colors.TEXT_PRIMARY,
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: isMine ? '600' : '400',
                },
                hasMedia && { paddingHorizontal: 6 },
              ]}
            >
              {msgText}
            </Text>
          )}
          {!!msgText && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 2,
                paddingHorizontal: hasMedia ? 6 : 0,
              }}
            >
              <Text
                style={[
                  stylesheet.bubbleTime,
                  {
                    color: isMine ? 'rgba(0,0,0,0.6)' : theme.colors.MUTED,
                    fontFamily: 'Inter',
                    fontSize: 10,
                  },
                ]}
              >
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              {isMine && (
                <Ionicons
                  name={item.is_read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.is_read ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const title =
    meta?.type === 'briefcase' ? meta?.business_name || 'Business' : otherUser?.name || 'Chat';

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
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.GLASS_BORDER,
          backgroundColor: theme.colors.DARK,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.SURFACE_ALT,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Feather
            name="chevron-left"
            size={20}
            color={theme.colors.TEXT_PRIMARY}
            style={{ marginLeft: -2 }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            justifyContent: 'center',
            marginHorizontal: 8,
          }}
          onPress={() => {
            const otherId = meta?.participant_ids?.find((pid: string) => pid !== user?.id);
            if (otherId) router.push(`/profile/${otherId}` as any);
          }}
        >
          {otherUser?.avatar_url && !avatarError && !otherUser.avatar_url.startsWith('file://') ? (
            <Image
              source={{ uri: otherUser.avatar_url }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
              contentFit="cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: theme.colors.G + '20',
                borderWidth: 1,
                borderColor: theme.colors.G + '30',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.G }}>
                {title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL }}>
              @{otherUser?.username || otherUser?.name || 'user'}
            </Text>
          </View>
        </TouchableOpacity>

        {Boolean(meta?.participant_ids?.find((pid: string) => pid !== user?.id)) && (
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => {
              Alert.alert('Options', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report User',
                  onPress: () => Alert.alert('Report', 'User reported successfully.'),
                },
                {
                  text: 'Block User',
                  style: 'destructive',
                  onPress: async () => {
                    const otherId = meta?.participant_ids?.find((pid: string) => pid !== user?.id);
                    if (otherId && profile) {
                      try {
                        const blocked = profile.blocked_users || [];
                        if (!blocked.includes(otherId)) {
                          await updateProfile({ blocked_users: [...blocked, otherId] });
                        }
                        Alert.alert('Blocked', 'User blocked successfully.');
                        router.replace('/(tabs)/messages');
                      } catch (e) {
                        console.error(e);
                        Alert.alert('Error', 'Failed to block user.');
                      }
                    }
                  },
                },
              ]);
            }}
          >
            <Feather name="more-horizontal" size={18} color={theme.colors.MUTED} />
          </TouchableOpacity>
        )}
      </View>

      {/* Item context banner */}
      {meta?.item_title && (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: 'rgba(255,255,255,0.015)',
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.GLASS_BORDER,
          }}
          onPress={() => {
            if (meta?.item_id) {
              if (meta.type === 'event') {
                router.push(`/events/${meta.item_id}` as any);
              } else if (meta.type === 'briefcase') {
                router.push(`/businesses/catalog/${meta.item_id}` as any);
              } else {
                router.push(`/marketplace/${meta.item_id}`);
              }
            }
          }}
          activeOpacity={0.7}
        >
          {meta.item_image && (
            <Image
              source={{ uri: meta.item_image }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: theme.colors.SURFACE,
              }}
              contentFit="cover"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Outfit-SemiBold',
                fontSize: 13,
                color: theme.colors.TEXT_PRIMARY,
              }}
              numberOfLines={1}
            >
              <Text style={{ color: theme.colors.MUTED, fontFamily: 'Outfit-Regular' }}>
                {meta.type === 'event' ? 'About: ' : 'Inquiring about: '}
              </Text>
              {meta.item_title}
            </Text>
            {typeof meta.item_price === 'number' && meta.type !== 'event' && (
              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 13, color: theme.colors.G }}>
                {meta.item_price === 0 ? 'FREE' : formatPrice(meta.item_price)}
              </Text>
            )}
          </View>
          <View
            style={{
              height: 30,
              paddingHorizontal: 12,
              borderRadius: 15,
              backgroundColor: 'rgba(130,219,126,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(130,219,126,0.18)',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold', fontSize: 12 }}>
              View {meta.type === 'event' ? 'Event' : 'Listing'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + (meta ? 130 : 61) : 0}>
        {/* Messages */}
        {loading ? (
          <View style={stylesheet.center}>
            <ActivityIndicator size="large" color={theme.colors.G} />
          </View>
        ) : messagesWithDates.length === 0 ? (
          <View style={stylesheet.center}>
            <Text
              style={[stylesheet.emptyText, { color: theme.colors.MUTED, fontFamily: 'Inter' }]}
            >
              No messages yet. Say hi! 👋
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messagesWithDates}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={stylesheet.msgListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (messagesWithDates.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
              }
            }}
            onLayout={() => {
              if (messagesWithDates.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
              }
            }}
          />
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 24),
            backgroundColor: theme.colors.DARK,
            borderTopWidth: 1,
            borderTopColor: theme.colors.GLASS_BORDER,
            gap: 12,
          }}
        >
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.SURFACE_ALT,
              borderWidth: 1,
              borderColor: theme.colors.GLASS_BORDER,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={pickMedia}
            disabled={uploadingMedia}
          >
            {uploadingMedia ? (
              <ActivityIndicator size="small" color={theme.colors.G} />
            ) : (
              <Feather name="plus" size={18} color={theme.colors.MUTED} />
            )}
          </TouchableOpacity>

          <View style={{ flex: 1, flexDirection: 'column' }}>
            {editingMessage && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: theme.colors.G, fontSize: 11, fontFamily: 'Inter-SemiBold' }}>
                  Editing message
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMessage(null);
                    setInputText('');
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.LABEL} />
                </TouchableOpacity>
              </View>
            )}
            <View
              style={{
                backgroundColor: theme.colors.SURFACE_ALT,
                borderWidth: 1,
                borderColor: inputText.trim()
                  ? 'rgba(130,219,126,0.22)'
                  : theme.colors.GLASS_BORDER,
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <TextInput
                style={{
                  color: theme.colors.TEXT_PRIMARY,
                  fontFamily: 'Inter-Regular',
                  fontSize: 15,
                  maxHeight: 96,
                  padding: 0,
                }}
                placeholder="Message…"
                placeholderTextColor={theme.colors.LABEL}
                value={inputText}
                onChangeText={setInputText}
                multiline
                onSubmitEditing={sendMessage}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                justifyContent: 'center',
                alignItems: 'center',
              },
              inputText.trim()
                ? { backgroundColor: theme.colors.G, borderColor: theme.colors.G }
                : {
                    backgroundColor: theme.colors.SURFACE_ALT,
                    borderColor: theme.colors.GLASS_BORDER,
                  },
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color={inputText.trim() ? '#000' : theme.colors.MUTED}
              />
            ) : (
              <Feather
                name="send"
                size={16}
                color={inputText.trim() ? '#000' : theme.colors.MUTED}
                style={{ marginLeft: -2, marginTop: 2 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ImageViewing
        images={viewerImages}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontWeight: 'bold', fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  contextImage: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  contextTitle: { fontSize: 13, fontWeight: '600' },
  contextPrice: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  msgListContent: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-start' },
  msgRow: { marginVertical: 4 },
  msgRowLeft: { alignItems: 'flex-start' },
  msgRowRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMine: {},
  bubbleTime: { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  attachBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {},
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 15, textAlign: 'center' },
}));

export default function ChatScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  return (
    <ErrorBoundary screenName="Chat">
      <ChatContent />
    </ErrorBoundary>
  );
}
