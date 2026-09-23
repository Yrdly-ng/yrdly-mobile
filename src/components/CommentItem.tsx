import { StyleSheet as UnistylesStyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { timeAgo } from '../lib/utils';
import { StorageService } from '../lib/storage-service';
import { Avatar } from './Avatar';
import { VerifiedBadge } from './VerifiedBadge';

export interface CommentType {
  id: string;
  user_id: string;
  author_name: string;
  author_image: string;
  text: string;
  timestamp: string;
  like_count: number;
  parent_id?: string;
  replies?: CommentType[];
  user?: {
    name: string;
    avatar_url: string;
    phone_verified?: boolean;
  };
  phone_verified?: boolean;
  is_liked?: boolean;
}

interface CommentItemProps {
  item: CommentType;
  currentUserId?: string;
  onReply?: (item: CommentType) => void;
  onLike?: (item: CommentType) => void;
  onDelete?: (item: CommentType) => void;
  onPressProfile?: (userId: string) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  item,
  currentUserId,
  onReply,
  onLike,
  onDelete,
  onPressProfile,
}) => {
  const { theme } = useUnistyles(); const styles = _stylesheet;
  const router = useRouter();
  const [showReplies, setShowReplies] = useState(false);

  const hasReplies = item.replies && item.replies.length > 0;
  const isReply = !!item.parent_id;
  const isOwner = currentUserId && item.user_id === currentUserId;

  // Removed unused useMemo

  const handleDelete = () => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete?.(item),
      },
    ]);
  };

  const handleProfilePress = () => {
    if (!item.user_id) return;
    if (onPressProfile) {
      onPressProfile(item.user_id);
    } else {
      router.push(`/profile/${item.user_id}` as any);
    }
  };

  return (
    <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
      <TouchableOpacity
        style={styles.commentRow}
        onLongPress={isOwner ? handleDelete : undefined}
        delayLongPress={500}
        activeOpacity={isOwner ? 0.6 : 1}
      >
        <TouchableOpacity style={styles.avatar} onPress={handleProfilePress}>
          <Avatar
            url={item.user?.avatar_url || item.author_image}
            name={item.user?.name || item.author_name}
            size={100}
            style={[styles.avatarImg, isReply && styles.avatarImgSmall]}
            fallbackTextStyle={isReply ? { fontSize: 12 } : undefined}
          />
        </TouchableOpacity>

        <View style={styles.commentContent}>
          <View style={styles.authorRow}>
            <Text
              style={[styles.authorName, { color: theme.colors.TEXT_PRIMARY }]}
              onPress={handleProfilePress}
            >
              {item.user?.name || item.author_name}
            </Text>
            {(item.user?.phone_verified || item.phone_verified) && (
              <View style={{ marginRight: 6 }}>
                <VerifiedBadge size={12} />
              </View>
            )}
            <Text style={[styles.timestamp, { color: '#9CA3AF' }]}>{timeAgo(item.timestamp)}</Text>
          </View>

          <Text style={[styles.commentText, { color: '#9CA3AF' }]}>{item.text}</Text>

          <View style={styles.commentActionsRow}>
            <TouchableOpacity onPress={() => onLike?.(item)} style={styles.actionBtn}>
              <Ionicons
                name={item.is_liked ? 'heart' : 'heart-outline'}
                size={13}
                color={item.is_liked ? '#EF4444' : '#9CA3AF'}
              />
              {item.like_count > 0 && (
                <Text
                  style={[styles.likeCountText, { color: item.is_liked ? '#EF4444' : '#9CA3AF' }]}
                >
                  {item.like_count}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onReply?.(item)} style={styles.actionBtn}>
              <Text style={[styles.replyText, { color: '#9CA3AF' }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {hasReplies && !showReplies && (
        <TouchableOpacity style={styles.viewRepliesBtn} onPress={() => setShowReplies(true)}>
          <View style={[styles.viewRepliesLine, { backgroundColor: theme.colors.GLASS_BORDER }]} />
          <Text style={[styles.viewRepliesText, { color: theme.colors.MUTED }]}>
            View {item.replies!.length} {item.replies!.length === 1 ? 'reply' : 'replies'}
          </Text>
        </TouchableOpacity>
      )}

      {hasReplies && showReplies && (
        <View style={styles.repliesList}>
          {item.replies!.map((reply) => (
            <CommentItem
              key={reply.id}
              item={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onLike={onLike}
              onDelete={onDelete}
              onPressProfile={onPressProfile}
            />
          ))}
          <TouchableOpacity style={styles.viewRepliesBtn} onPress={() => setShowReplies(false)}>
            <View
              style={[styles.viewRepliesLine, { backgroundColor: theme.colors.GLASS_BORDER }]}
            />
            <Text style={[styles.viewRepliesText, { color: theme.colors.MUTED }]}>
              Hide replies
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const _stylesheet = UnistylesStyleSheet.create((theme) => ({
  commentContainer: {
    marginBottom: 16,
  },
  replyContainer: {
    marginLeft: 44,
    marginBottom: 12,
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  avatar: {
    marginRight: 12,
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.SURFACE,
  },
  avatarImgSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  commentContent: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  authorName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginRight: 2,
  },
  timestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  commentText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  likeCountText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginLeft: 4,
  },
  replyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  viewRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 66,
    marginTop: 4,
  },
  viewRepliesLine: {
    width: 24,
    height: 1,
    marginRight: 8,
  },
  viewRepliesText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  repliesList: {
    marginTop: 12,
  },
}));
