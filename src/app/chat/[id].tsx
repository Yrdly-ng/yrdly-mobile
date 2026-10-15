import { privateMediaReference } from '@/lib/media/private-media';
import { usePrivateMedia } from '@/hooks/use-private-media';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import { useIsFocused } from 'expo-router/react-navigation';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { StorageService, type MobileFile } from '@/lib/media/storage-service';
import NetInfo from '@react-native-community/netinfo';
import { discardEditedImage } from '@/hooks/use-image-editor';
import { localCache } from '@/lib/offline/local-cache';
import { checkActiveSession } from '@/lib/auth/session-policy';
import ImageViewing from 'react-native-image-viewing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../../lib/supabase/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { useAppTheme } from '../../context/ThemeContext';
import { formatPrice } from '../../lib/shared/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { setActiveConversationId } from '../../lib/offline/active-chat-tracker';
import { useVideoEditor, discardEditedVideo } from '@/hooks/use-video-editor';

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
  conversation_id?: string;
  local_status?: 'sending' | 'sent' | 'failed';
  local_asset?: MobileFile;
  delivered_by?: string[];
  read_by?: string[];
}

interface ConversationMeta {
  id: string;
  type: 'friend' | 'marketplace' | 'briefcase' | 'event' | 'business';
  participant_ids: string[];
  item_id?: string;
  item_title?: string;
  item_image?: string;
  item_price?: number;
  business_id?: string;
  business_name?: string;
  business_image?: string;
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
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
      />
    );
  }
);

function ChatContent() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

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
  const paramBusinessId = params.business_id as string | undefined;
  const paramBusinessName = params.business_name as string | undefined;
  const paramBusinessImage = params.business_image as string | undefined;
  const outboxKey =
    id === 'new'
      ? JSON.stringify(['new', paramParticipantId, paramType, paramBusinessId, paramItemId])
      : id;
  const { user, profile, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && id && id !== 'new') {
      setActiveConversationId(id);
    } else {
      setActiveConversationId(null);
    }
    return () => {
      setActiveConversationId(null);
    };
  }, [isFocused, id]);

  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [otherUser, setOtherUser] = useState<{
    name: string;
    avatar_url: string | null;
    username?: string | null;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const mediaUrls = usePrivateMedia(
    messages.map((message) => message.media_url).filter((value): value is string => !!value),
    user?.id,
    isFocused
  );
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const pendingMessages = useRef(new Map<string, Message>());
  const inFlightMessages = useRef(new Set<string>());
  const newConversationId = useRef<string | null>(null);
  const conversationCreation = useRef<Promise<string> | null>(null);
  const requestContext = useRef(`${user?.id || ''}:${outboxKey}`);
  const submitting = useRef(false);
  useLayoutEffect(() => {
    requestContext.current = `${user?.id || ''}:${outboxKey}`;
  }, [user?.id, outboxKey]);
  const currentOwner = useRef(user?.id);
  useLayoutEffect(() => {
    currentOwner.current = user?.id;
  }, [user?.id]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const autoScroll = useRef(true);
  const receiptInFlight = useRef(new Set<string>());
  const seenRead = useRef(new Set<string>());
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadController = useRef<AbortController | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const { editVideo, videoEditor, isEditingVideo } = useVideoEditor();
  const pickingMedia = useRef(false);
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

  useEffect(() => {
    pendingMessages.current.clear();
    inFlightMessages.current.clear();
    receiptInFlight.current.clear();
    seenRead.current.clear();
    setMessages([]);
    setOtherUser(null);
    setMeta(null);
    setInputText('');
    setEditingMessage(null);
    autoScroll.current = true;
    newConversationId.current = null;
    conversationCreation.current = null;
    if (!user?.id || !id) return;
    let active = true;
    void localCache.read<Message[]>(user.id, 'outbox', outboxKey, 7 * 86400000).then((cached) => {
      if (!active || !cached) return;
      const pending = cached.value.map((message) => ({
        ...message,
        local_status: 'failed' as const,
      }));
      pending.forEach((message) => pendingMessages.current.set(message.id, message));
      setMessages((previous) =>
        Array.from(
          new Map([...pending, ...previous].map((message) => [message.id, message])).values()
        ).sort((a, b) => a.created_at.localeCompare(b.created_at))
      );
    });
    return () => {
      active = false;
      uploadController.current?.abort();
    };
  }, [user?.id, outboxKey]);

  const fetchMeta = useCallback(async () => {
    if (!id || !user) return;
    const context = requestContext.current;
    if (id === 'new') {
      setMeta({
        id: 'new',
        type: paramType as any,
        participant_ids: [user.id, paramParticipantId as string],
        item_id: paramItemId as string,
        item_title: paramItemTitle as string,
        item_image: paramItemImage as string,
        item_price: paramItemPrice ? Number(paramItemPrice) : undefined,
        business_id: paramBusinessId,
        business_name: paramBusinessName,
        business_image: paramBusinessImage,
      });
      if (paramParticipantId) {
        const { data: u } = await supabase
          .from('public_profiles')
          .select('name, avatar_url, username')
          .eq('id', paramParticipantId)
          .single();
        if (context !== requestContext.current) return;
        if (u) {
          setOtherUser(u);
          setAvatarError(false);
        }
      }
      setLoading(false);
      return;
    }

    const { data } = await supabase.from('conversations').select('*').eq('id', id).single();
    if (context !== requestContext.current) return;
    if (data) {
      if (data.type === 'group') {
        setLoading(false);
        Alert.alert(
          'Group chats are unavailable',
          'Use Communities to talk with people around shared interests.'
        );
        router.replace('/(tabs)/messages' as any);
        return;
      }

      let resolvedMeta: ConversationMeta = { ...data };
      const otherId = data.participant_ids?.find((pid: string) => pid !== user.id);

      // If business chat and missing business name/image, attempt lookup
      if ((data.type === 'business' || data.type === 'briefcase' || data.business_id) && otherId) {
        if (!resolvedMeta.business_name || !resolvedMeta.business_image) {
          const query = data.business_id
            ? supabase
                .from('businesses')
                .select('id, name, logo, logo_url, cover_image, image_urls')
                .eq('id', data.business_id)
                .maybeSingle()
            : supabase
                .from('businesses')
                .select('id, name, logo, logo_url, cover_image, image_urls')
                .eq('owner_id', otherId)
                .maybeSingle();
          const { data: b } = await query;
          if (context !== requestContext.current) return;
          if (b) {
            resolvedMeta.business_id = b.id;
            resolvedMeta.business_name = resolvedMeta.business_name || b.name;
            resolvedMeta.business_image =
              resolvedMeta.business_image ||
              b.logo ||
              b.logo_url ||
              b.image_urls?.[0] ||
              b.cover_image ||
              undefined;
          }
        }
      }

      setMeta(resolvedMeta);

      if (otherId) {
        const { data: u } = await supabase
          .from('public_profiles')
          .select('name, avatar_url, username')
          .eq('id', otherId)
          .single();
        if (context !== requestContext.current) return;
        if (u) {
          setOtherUser(u);
          setAvatarError(false);
        }
      }
    }
    setLoading(false);
  }, [
    id,
    user?.id,
    paramType,
    paramParticipantId,
    paramItemId,
    paramItemTitle,
    paramItemImage,
    paramItemPrice,
    paramBusinessId,
    paramBusinessName,
    paramBusinessImage,
  ]);

  const acknowledge = useCallback(
    async (rows: Message[], read = false) => {
      const owner = user?.id;
      if (!owner || !isFocused || AppState.currentState !== 'active') return;
      const candidates = rows.filter(
        (message) =>
          message.sender_id !== owner &&
          !(read ? message.read_by : message.delivered_by)?.includes(owner) &&
          !receiptInFlight.current.has(`${read}:${message.id}`) &&
          (!read || !seenRead.current.has(message.id))
      );
      for (let offset = 0; offset < candidates.length; offset += 50) {
        const batch = candidates.slice(offset, offset + 50);
        batch.forEach((message) => receiptInFlight.current.add(`${read}:${message.id}`));
        try {
          const { error } = await supabase.rpc('acknowledge_messages', {
            p_message_ids: batch.map((message) => message.id),
            p_read: read,
          });
          if (!error && read) batch.forEach((message) => seenRead.current.add(message.id));
        } finally {
          batch.forEach((message) => receiptInFlight.current.delete(`${read}:${message.id}`));
        }
      }
    },
    [user?.id, isFocused]
  );

  const fetchMessages = useCallback(async () => {
    const historyId = id === 'new' ? meta?.id : id;
    if (!historyId || historyId === 'new') {
      setLoading(false);
      return;
    }

    const context = requestContext.current;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', historyId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50);

    if (context !== requestContext.current) return;
    if (!error && data) {
      data.forEach((message) => pendingMessages.current.delete(message.id));
      persistOutbox();
      const history = (data as Message[]).reverse();
      setMessages((previous) =>
        Array.from(
          new Map([...previous, ...history].map((message) => [message.id, message])).values()
        ).sort((a, b) => a.created_at.localeCompare(b.created_at))
      );

      void acknowledge(history);
    }
    setLoading(false);
  }, [id, meta?.id, user?.id, isFocused, acknowledge]);

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
    const liveId = id === 'new' ? meta?.id : id;
    if (!meta || !liveId || liveId === 'new' || !isFocused) return;

    fetchMessages();

    // Realtime subscriptions for messages table
    const ch = supabase
      .channel(`chat-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${liveId}`,
        },
        (payload) => {
          const confirmedMessage = payload.new as Message;
          if (pendingMessages.current.has(confirmedMessage.id)) {
            pendingMessages.current.delete(confirmedMessage.id);
            persistOutbox();
          }
          setMessages((previous) => {
            const confirmed = payload.new as Message;
            return previous.some((message) => message.id === confirmed.id)
              ? previous.map((message) =>
                  message.id === confirmed.id ? { ...confirmed, local_status: 'sent' } : message
                )
              : [...previous, confirmed];
          });
          if (autoScroll.current)
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

          // Arrival proves delivery. Read acknowledgement waits for visible rows.
          void acknowledge([payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${liveId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void fetchMessages();
      });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchMessages();
    });
    const network = NetInfo.addEventListener((state) => {
      if (state.isConnected && AppState.currentState === 'active') void fetchMessages();
    });
    return () => {
      app.remove();
      network();
      supabase.removeChannel(ch);
    };
  }, [id, meta?.id, fetchMessages, isFocused, user?.id, acknowledge]);

  const createConversation = async (summary: string): Promise<string> => {
    if (!user || !id) throw new Error('Sign in to send messages.');
    const creationContext = requestContext.current;
    let currentConvId = id === 'new' ? newConversationId.current || id : id;
    if (id === 'new' && !newConversationId.current) {
      let validItemId = paramItemId || null;
      if (validItemId) {
        const [{ data: pData }, { data: cData }] = await Promise.all([
          supabase.from('posts').select('id').eq('id', validItemId).maybeSingle(),
          supabase.from('catalog_items').select('id').eq('id', validItemId).maybeSingle(),
        ]);
        if (!pData && !cData) {
          validItemId = null;
        }
      }

      const { data: newConv, error: newError } = await supabase
        .from('conversations')
        .insert({
          type: paramType || 'friend',
          participant_ids: [user.id, paramParticipantId],
          item_id: validItemId,
          item_title: paramItemTitle || null,
          item_image: paramItemImage || null,
          item_price: paramItemPrice ? Number(paramItemPrice) : null,
          business_id: paramBusinessId || null,
          business_name: paramBusinessName || null,
          business_image: paramBusinessImage || null,
          last_message_text: summary,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (creationContext !== requestContext.current) throw new Error('Conversation changed.');
      if (newError) throw newError;
      if (!newConv) throw new Error('Conversation was not created — server returned no data.');
      currentConvId = newConv.id;
      newConversationId.current = newConv.id;
    }

    return currentConvId;
  };

  const ensureConversation = (summary: string): Promise<string> => {
    if (id !== 'new') return Promise.resolve(id);
    if (newConversationId.current) return Promise.resolve(newConversationId.current);
    if (!conversationCreation.current)
      conversationCreation.current = createConversation(summary).finally(() => {
        conversationCreation.current = null;
      });
    return conversationCreation.current;
  };

  const loadOlder = async () => {
    if (loadingOlder || !id || id === 'new') return;
    const first = messages.find(
      (message) => !message.local_status || message.local_status === 'sent'
    );
    if (!first) return;
    autoScroll.current = false;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .or(
          `created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50);
      if (!error && data)
        setMessages((previous) =>
          Array.from(
            new Map(
              [...data.reverse(), ...previous].map((message) => [message.id, message])
            ).values()
          ).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        );
    } finally {
      setLoadingOlder(false);
    }
  };

  const persistOutbox = () => {
    if (user?.id)
      void localCache.write(
        user.id,
        'outbox',
        outboxKey,
        Array.from(pendingMessages.current.values())
      );
  };

  const deliverMessage = async (message: Message) => {
    if (!user || inFlightMessages.current.has(message.id)) return;
    inFlightMessages.current.add(message.id);
    const owner = user.id;
    const context = requestContext.current;
    setMessages((previous) =>
      previous.map((row) => (row.id === message.id ? { ...row, local_status: 'sending' } : row))
    );
    try {
      if (currentOwner.current !== owner || requestContext.current !== context) return;
      if ((await checkActiveSession()) === false)
        throw new Error('Your session has ended. Please sign in again.');
      const currentConvId =
        message.conversation_id && message.conversation_id !== 'new'
          ? message.conversation_id
          : await ensureConversation(message.text || '');
      if (id === 'new')
        setMeta((previous) => (previous ? { ...previous, id: currentConvId } : previous));
      const pending = { ...message, conversation_id: currentConvId };
      pendingMessages.current.set(message.id, pending);
      persistOutbox();
      if (currentOwner.current !== owner || requestContext.current !== context) return;
      let mediaReference = message.media_url;
      if (message.local_asset) {
        const asset = message.local_asset;
        const isVideo = asset.type.startsWith('video/');
        const extension =
          asset.name
            .split('.')
            .pop()
            ?.replace(/[^a-z0-9]/gi, '') || (isVideo ? 'mp4' : 'jpg');
        const path = `chat/${currentConvId}/${owner}-${message.id}.${extension}`;
        const bucket = isVideo ? 'chat-videos' : 'chat-images';
        const controller = new AbortController();
        uploadController.current = controller;
        setUploadingMedia(true);
        setUploadProgress(0);
        try {
          const existing = await supabase.storage.from(bucket).createSignedUrl(path, 60);
          if (!existing.data?.signedUrl) {
            const upload = await StorageService.uploadFile(
              bucket,
              path,
              asset,
              { contentType: asset.type, signal: controller.signal },
              setUploadProgress
            );
            if (upload.error) throw upload.error;
          }
          if (controller.signal.aborted) throw new Error('Upload cancelled');
          mediaReference = privateMediaReference(bucket, path);
        } finally {
          uploadController.current = null;
          setUploadingMedia(false);
        }
      }
      if (currentOwner.current !== owner || requestContext.current !== context) return;
      const payload = {
        id: message.id,
        sender_id: owner,
        text: message.text || '',
        created_at: message.created_at,
        conversation_id: currentConvId,
        ...(mediaReference ? { media_url: mediaReference, media_type: message.media_type } : {}),
      };
      const result = await supabase
        .from('messages')
        .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .maybeSingle();
      if (result.error) throw result.error;
      // A retry after an uncertain response returns the existing authoritative row.
      const confirmed =
        result.data ||
        (
          await supabase
            .from('messages')
            .select('*')
            .eq('id', message.id)
            .eq('sender_id', owner)
            .eq('conversation_id', currentConvId)
            .single()
        ).data;
      if (!confirmed) throw new Error('Message acknowledgement unavailable. Tap to retry.');
      if (currentOwner.current !== owner || requestContext.current !== context) return;
      pendingMessages.current.delete(message.id);
      persistOutbox();
      setMessages((previous) =>
        previous.map((row) =>
          row.id === message.id ? { ...confirmed, local_status: 'sent' } : row
        )
      );
      void supabase
        .from('conversations')
        .update({
          last_message_text: message.text,
          updated_at: confirmed.created_at,
          deleted_by: [],
        })
        .eq('id', currentConvId)
        .then();
      const recipient = meta?.participant_ids?.find((pid) => pid !== owner) || paramParticipantId;
      if (message.local_asset) {
        void discardEditedVideo(message.local_asset);
        void discardEditedImage(message.local_asset);
      }
      if (recipient && result.data) {
        void import('../../lib/notifications/notification-triggers')
          .then(({ NotificationTriggers }) =>
            NotificationTriggers.onMessageSent(recipient, owner, currentConvId, message.text || '')
          )
          .catch(() => {});
      }
      if (id === 'new' && pendingMessages.current.size === 0 && inFlightMessages.current.size === 1)
        router.replace({ pathname: '/chat/[id]', params: { id: currentConvId } });
    } catch {
      if (
        currentOwner.current !== owner ||
        requestContext.current !== context ||
        !pendingMessages.current.has(message.id)
      )
        return;
      const failed = {
        ...(pendingMessages.current.get(message.id) || message),
        local_status: 'failed' as const,
      };
      pendingMessages.current.set(message.id, failed);
      persistOutbox();
      setMessages((previous) => previous.map((row) => (row.id === message.id ? failed : row)));
    } finally {
      inFlightMessages.current.delete(message.id);
    }
  };

  const sendMessage = async () => {
    if (
      submitting.current ||
      !inputText.trim() ||
      !user ||
      !id ||
      sending ||
      isEditingVideo ||
      pickingMedia.current
    )
      return;
    submitting.current = true;
    queueMicrotask(() => {
      submitting.current = false;
    });
    const body = inputText.trim();
    setInputText('');
    if (editingMessage) {
      setSending(true);
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
            setInputText(body);
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
            supabase
              .from('conversations')
              .update({ last_message_text: newText })
              .eq('id', id)
              .then();
          }

          setEditingMessage(null);
          setSending(false);
          return;
        }
      } catch {
        setInputText(body);
        Alert.alert('Could not edit', 'Please try again.');
      } finally {
        setSending(false);
      }
      return;
    }
    const message: Message = {
      id: Crypto.randomUUID(),
      sender_id: user.id,
      text: body,
      created_at: new Date().toISOString(),
      conversation_id: id,
      local_status: 'sending',
    };
    pendingMessages.current.set(message.id, message);
    persistOutbox();
    autoScroll.current = true;
    setMessages((previous) => [...previous, message]);
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    void deliverMessage(message);
  };

  const handlePickMedia = async (type: 'photo' | 'video') => {
    if (sending || uploadingMedia || isEditingVideo || pickingMedia.current) return;
    pickingMedia.current = true;
    try {
      const isPhoto = type === 'photo';
      const options: any = { mediaType: type };

      if (isPhoto) {
        options.cropping = true;
        options.freeStyleCropEnabled = true;
        options.compressImageQuality = 0.88;
        options.compressImageMaxWidth = 2048;
        options.compressImageMaxHeight = 2048;
      }

      const image = await ImagePicker.openPicker(options);

      if (image) {
        const selected = image as any;
        let media = {
          uri: selected.path,
          type: selected.mime || (selected.path.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'),
          name: selected.filename || (type === 'video' ? 'video.mp4' : 'photo.jpg'),
        };
        if (type === 'video') {
          const edited = await editVideo(media, 15 * 1024 * 1024);
          if (!edited) return;
          media = edited;
        }
        await uploadAndSendMedia(media);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection' && e.message !== 'User cancelled') {
        console.log('ImagePicker error:', e);
        Alert.alert('Error', e.message || 'Failed to pick media');
      }
    } finally {
      pickingMedia.current = false;
    }
  };

  const pickMedia = () => {
    Alert.alert('Attach Media', 'Choose the type of media to upload', [
      { text: 'Photo', onPress: () => handlePickMedia('photo') },
      { text: 'Video', onPress: () => handlePickMedia('video') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAndSendMedia = async (asset: { uri: string; type?: string; name?: string }) => {
    if (!user || !id || uploadingMedia) return;
    const type = asset.type || 'image/jpeg';
    const message: Message = {
      id: Crypto.randomUUID(),
      sender_id: user.id,
      created_at: new Date().toISOString(),
      conversation_id: id,
      text: '',
      media_type: type.startsWith('video/') ? 'video' : 'image',
      local_asset: {
        uri: asset.uri,
        type,
        name: asset.name || (type.startsWith('video/') ? 'video.mp4' : 'photo.jpg'),
      },
      local_status: 'sending',
    };
    pendingMessages.current.set(message.id, message);
    persistOutbox();
    autoScroll.current = true;
    setMessages((previous) => [...previous, message]);
    await deliverMessage(message);
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
    const imgUrl =
      item.media_type === 'image' ? item.local_asset?.uri || mediaUrls[item.media_url] : null;
    const vidUrl =
      item.media_type === 'video' ? item.local_asset?.uri || mediaUrls[item.media_url] : null;
    const hasMedia = !!item.media_url || !!item.local_asset;

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
          {hasMedia && !imgUrl && !vidUrl && (
            <Text style={stylesheet.bubbleText}>Attachment unavailable or loading…</Text>
          )}
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
              {isMine && (item.local_status === 'sending' || item.local_status === 'failed') ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.local_status === 'failed' ? 'Retry failed message' : 'Sending message'
                  }
                  disabled={item.local_status === 'sending'}
                  onPress={() => void deliverMessage(item)}
                  style={{ padding: 6 }}
                >
                  <Text style={{ color: '#17351C', fontSize: 11 }}>
                    {item.local_status === 'failed' ? 'Failed · Retry' : 'Sending…'}
                  </Text>
                </TouchableOpacity>
              ) : (
                isMine && (
                  <Ionicons
                    accessibilityLabel={
                      item.is_read ? 'Read' : item.delivered_by?.length ? 'Delivered' : 'Sent'
                    }
                    name={
                      item.is_read || item.delivered_by?.length ? 'checkmark-done' : 'checkmark'
                    }
                    size={14}
                    color={item.is_read ? theme.colors.TEXT_PRIMARY : theme.colors.LABEL}
                    style={{ marginLeft: 4 }}
                  />
                )
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const handleViewListing = useCallback(async () => {
    if (!meta) return;

    try {
      const itemId = meta.item_id;

      if (itemId) {
        // 1. Check if itemId matches a catalog item
        const { data: catItem } = await supabase
          .from('catalog_items')
          .select('id, business_id')
          .eq('id', itemId)
          .maybeSingle();

        if (catItem) {
          router.push(`/businesses/catalog/${catItem.id}` as any);
          return;
        }

        // 2. Check if itemId matches a business ID or owner ID
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .or(`id.eq.${itemId},owner_id.eq.${itemId}`)
          .limit(1)
          .maybeSingle();

        if (biz) {
          router.push(`/businesses/${biz.id}` as any);
          return;
        }

        // 3. Check if itemId matches a post
        const { data: post } = await supabase
          .from('posts')
          .select('id, category')
          .eq('id', itemId)
          .maybeSingle();

        if (post) {
          if (post.category === 'For Sale') {
            router.push(`/marketplace/${post.id}`);
          } else if (post.category === 'Event') {
            router.push(`/events/${post.id}`);
          } else {
            router.push(`/posts/${post.id}`);
          }
          return;
        }

        // 4. Check if itemId matches an event
        const { data: evt } = await supabase
          .from('events')
          .select('id')
          .eq('id', itemId)
          .maybeSingle();

        if (evt) {
          router.push(`/events/${evt.id}`);
          return;
        }
      }

      // 4.5. Check direct business_id if present
      if (meta.business_id) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('id', meta.business_id)
          .maybeSingle();

        if (biz) {
          router.push(`/businesses/${biz.id}` as any);
          return;
        }
      }

      // 5. Fallback lookup by other participant's business
      const otherId = meta.participant_ids?.find((pid: string) => pid !== user?.id);
      if (otherId) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', otherId)
          .limit(1)
          .maybeSingle();

        if (biz) {
          router.push(`/businesses/${biz.id}` as any);
          return;
        }
      }

      // 6. Fallback lookup by item title
      if (meta.item_title) {
        const cleanTitle = meta.item_title.replace(/\s*\(.*\)$/, '').trim();
        const { data: catItem } = await supabase
          .from('catalog_items')
          .select('id')
          .ilike('title', `%${cleanTitle}%`)
          .limit(1)
          .maybeSingle();

        if (catItem) {
          router.push(`/businesses/catalog/${catItem.id}` as any);
          return;
        }

        const { data: post } = await supabase
          .from('posts')
          .select('id, category')
          .ilike('title', `%${cleanTitle}%`)
          .limit(1)
          .maybeSingle();

        if (post) {
          if (post.category === 'For Sale') {
            router.push(`/marketplace/${post.id}`);
          } else {
            router.push(`/posts/${post.id}`);
          }
          return;
        }
      }

      Alert.alert(
        'Listing Unavailable',
        'The item or business listing associated with this chat is no longer available.'
      );
    } catch (e) {
      console.error('Error viewing listing:', e);
      Alert.alert('Error', 'Unable to open listing at this time.');
    }
  }, [meta, user, router]);

  const isBusinessChat =
    meta?.type === 'briefcase' || meta?.type === 'business' || !!meta?.business_id;
  const title = isBusinessChat
    ? meta?.business_name || meta?.item_title || otherUser?.name || 'Business'
    : otherUser?.name || 'Chat';
  const displayAvatar = isBusinessChat
    ? meta?.business_image || meta?.item_image || otherUser?.avatar_url
    : otherUser?.avatar_url;

  return (
    <KeyboardAvoidingView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {videoEditor}
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
            if (isBusinessChat && meta?.business_id) {
              router.push(`/businesses/${meta.business_id}` as any);
            } else {
              const otherId = meta?.participant_ids?.find((pid: string) => pid !== user?.id);
              if (otherId) router.push(`/profile/${otherId}` as any);
            }
          }}
        >
          {displayAvatar && !avatarError && !displayAvatar.startsWith('file://') ? (
            <Image
              source={{ uri: displayAvatar }}
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
              {`@${otherUser?.username || otherUser?.name || 'user'}`}
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
          onPress={handleViewListing}
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

      <View style={{ flex: 1 }}>
        {uploadingMedia && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
            <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
              Uploading attachment · {Math.round(uploadProgress * 100)}%
            </Text>
            <TouchableOpacity
              onPress={() => uploadController.current?.abort()}
              accessibilityRole="button"
            >
              <Text style={{ color: theme.colors.G }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
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
            ListHeaderComponent={
              id !== 'new' && messages.length >= 50 ? (
                <TouchableOpacity
                  disabled={loadingOlder}
                  onPress={() => void loadOlder()}
                  style={{ padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.colors.G }}>
                    {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={stylesheet.msgListContent}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              autoScroll.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
            }}
            scrollEventThrottle={100}
            onViewableItemsChanged={({ viewableItems }) => {
              void acknowledge(
                viewableItems.map((row) => row.item as Message).filter((row) => !!row.sender_id),
                true
              );
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 500 }}
            onContentSizeChange={() => {
              if (autoScroll.current && messagesWithDates.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
              }
            }}
            onLayout={() => {
              if (autoScroll.current && messagesWithDates.length > 0) {
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
      </View>

      <ImageViewing
        images={viewerImages}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
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
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  return (
    <ErrorBoundary screenName="Chat">
      <ChatContent />
    </ErrorBoundary>
  );
}
