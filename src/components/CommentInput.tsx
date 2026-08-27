import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface CommentInputProps {
  userAvatarSource: string;
  userInitial: string;
  replyingTo: { id: string; name: string } | null;
  onClearReply: () => void;
  onSubmit: (text: string, parentId?: string) => Promise<void>;
  InputComponent?: any; // To allow passing BottomSheetTextInput
}

export interface CommentInputRef {
  focus: () => void;
}

export const CommentInput = forwardRef<CommentInputRef, CommentInputProps>(
  (
    {
      userAvatarSource,
      userInitial,
      replyingTo,
      onClearReply,
      onSubmit,
      InputComponent = TextInput,
    },
    ref
  ) => {
    const { styles: stylesheet, theme } = useStyles(_stylesheet);

    const insets = useSafeAreaInsets();
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef<any>(null);

    // iOS Keyboard Gap Fix
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    React.useEffect(() => {
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

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const avatarSource = useMemo(() => ({ uri: userAvatarSource }), [userAvatarSource]);

    const handleSend = async () => {
      if (!inputText.trim() || sending) return;
      setSending(true);
      const body = inputText.trim();
      setInputText('');

      try {
        await onSubmit(body, replyingTo?.id);
        onClearReply();
      } catch (e) {
        console.error(e);
        setInputText(body);
      } finally {
        setSending(false);
      }
    };

    return (
      <View
        style={[
          stylesheet.container,
          {
            borderTopColor: theme.colors.GLASS_BORDER,
            backgroundColor: theme.colors.DARK,
            paddingBottom: keyboardVisible
              ? Platform.OS === 'android'
                ? 12
                : 12
              : Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12),
          },
        ]}
      >
        {replyingTo && (
          <View style={stylesheet.replyBanner}>
            <Text style={[stylesheet.replyBannerText, { color: theme.colors.MUTED }]}>
              Replying to <Text style={{ fontWeight: 'bold' }}>{replyingTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={onClearReply} style={stylesheet.clearReplyBtn}>
              <Ionicons name="close-circle" size={18} color={theme.colors.MUTED} />
            </TouchableOpacity>
          </View>
        )}

        <View style={stylesheet.inputRow}>
          <View style={stylesheet.inputAvatar}>
            {userAvatarSource ? (
              <Image source={avatarSource} style={stylesheet.avatarImg} contentFit="cover" />
            ) : (
              <View
                style={[
                  stylesheet.avatarImg,
                  stylesheet.avatarFallback,
                  { backgroundColor: theme.colors.G },
                ]}
              >
                <Text style={stylesheet.avatarFallbackText}>{userInitial}</Text>
              </View>
            )}
          </View>
          <View style={[stylesheet.inputWrapper, { backgroundColor: theme.colors.SURFACE }]}>
            <InputComponent
              ref={inputRef}
              style={[stylesheet.input, { color: theme.colors.TEXT_PRIMARY }]}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a comment...'}
              placeholderTextColor={theme.colors.MUTED}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={stylesheet.sendBtn}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.G} />
              ) : (
                <Text
                  style={[
                    stylesheet.sendText,
                    { color: inputText.trim() ? '#82DB7E' : theme.colors.MUTED },
                  ]}
                >
                  Post
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  replyBannerText: {
    fontSize: 13,
  },
  clearReplyBtn: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputAvatar: {
    marginRight: 12,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: theme.colors.TEXT_PRIMARY,
    fontWeight: 'bold',
    fontSize: 14,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 40,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
}));
