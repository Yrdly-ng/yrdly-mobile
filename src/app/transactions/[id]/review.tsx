import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { ReviewService } from '../../../lib/review-service';
import { UserReviewService } from '../../../lib/user-review-service';
import { Avatar } from '../../../components/Avatar';

interface TxInfo {
  id: string;
  seller_id: string;
  seller: { id: string; name: string; avatar_url: string | null } | null;
  item: { id: string; title: string; image_urls: string[] | null } | null;
}

export default function ReviewScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [tx, setTx] = useState<TxInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isUserReview, setIsUserReview] = useState(false);
  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('escrow_transactions')
          .select(
            `
            id, seller_id,
            seller:users!escrow_transactions_seller_id_fkey(id, name, avatar_url),
            post_item:posts(id, title, image_urls, image_url),
            catalog_item:catalog_items(id, title, images)
          `
          )
          .eq('id', id)
          .single();
        if (error) throw error;

        const sellerObj = Array.isArray(data.seller) ? (data.seller[0] ?? null) : data.seller;
        const postItem = Array.isArray(data.post_item) ? data.post_item[0] : data.post_item;
        const catalogItem = Array.isArray(data.catalog_item) ? data.catalog_item[0] : data.catalog_item;

        const itemTitle = postItem?.title || catalogItem?.title || 'Item';
        const itemImgs = postItem
          ? Array.isArray(postItem.image_urls) && postItem.image_urls.length > 0
            ? postItem.image_urls
            : postItem.image_url
            ? [postItem.image_url]
            : null
          : catalogItem?.images || null;

        const normalised: TxInfo = {
          id: data.id,
          seller_id: data.seller_id,
          seller: sellerObj,
          item: {
            id: postItem?.id || catalogItem?.id || '',
            title: itemTitle,
            image_urls: itemImgs,
          },
        };
        setTx(normalised);

        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', normalised.seller_id)
          .maybeSingle();

        if (biz) {
          setBusinessId(biz.id);
          const { canReview: eligible } = await ReviewService.canUserReviewBusiness(
            user.id,
            biz.id,
            id
          );
          setCanReview(eligible);
        } else {
          setIsUserReview(true);
          const { canReview: eligible } = await UserReviewService.canUserReviewSeller(
            user.id,
            normalised.seller_id,
            id
          );
          setCanReview(eligible);
        }
      } catch (e) {
        console.error('Failed to load tx:', e);
        Alert.alert('Error', 'Could not load transaction.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const handleSubmit = async () => {
    if (!user || !id) return;
    if (!isUserReview && !businessId) return;
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      if (isUserReview) {
        await UserReviewService.submitReview(
          tx?.seller_id!,
          user.id,
          id,
          rating,
          comment.trim() || undefined
        );
      } else {
        await ReviewService.submitReview(
          businessId!,
          user.id,
          id,
          rating,
          comment.trim() || undefined
        );
      }
      Alert.alert('Thank You!', 'Your review has been submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );

  const thumb = tx?.item?.image_urls?.[0];
  const LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent!'];

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <View
        style={[
          stylesheet.header,
          { backgroundColor: theme.colors.SURFACE, borderBottomColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Feather name="x" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Leave a Review
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={stylesheet.scroll} showsVerticalScrollIndicator={false}>
        <View style={[stylesheet.card, { backgroundColor: theme.colors.SURFACE }]}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={stylesheet.itemImage} contentFit="cover" />
          ) : (
            <View
              style={[
                stylesheet.itemImage,
                stylesheet.imgPlaceholder,
                { backgroundColor: theme.colors.GLASS_BORDER },
              ]}
            >
              <Feather name="box" size={28} color={theme.colors.MUTED} />
            </View>
          )}
          <View style={stylesheet.cardInfo}>
            <Text
              style={[stylesheet.itemTitle, { color: theme.colors.TEXT_PRIMARY }]}
              numberOfLines={2}
            >
              {tx?.item?.title || 'Item'}
            </Text>
            <View style={stylesheet.sellerRow}>
              <Avatar
                url={tx?.seller?.avatar_url}
                name={tx?.seller?.name}
                size={24}
                style={stylesheet.avatar as any}
                fallbackStyle={[stylesheet.avatar, stylesheet.avatarFallback] as any}
                fallbackTextStyle={[stylesheet.avatarInitial, { color: theme.colors.G }] as any}
              />
              <Text style={[stylesheet.sellerName, { color: theme.colors.MUTED }]}>
                Sold by {tx?.seller?.name ?? 'Seller'}
              </Text>
            </View>
          </View>
        </View>

        {!canReview && !loading ? (
          <View style={stylesheet.alreadyBox}>
            <Feather name="check-circle" size={52} color={theme.colors.G} />
            <Text style={[stylesheet.alreadyTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              Already Reviewed
            </Text>
            <Text style={[stylesheet.alreadySub, { color: theme.colors.MUTED }]}>
              You've already submitted a review for this transaction.
            </Text>
          </View>
        ) : (
          <>
            <View style={stylesheet.section}>
              <Text style={[stylesheet.sectionLabel, { color: theme.colors.MUTED }]}>
                YOUR RATING
              </Text>
              <View style={stylesheet.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => {
                  return (
                    <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                      <Feather
                        name={s <= rating ? 'star' : 'star'}
                        size={44}
                        color={s <= rating ? '#FFC107' : theme.colors.GLASS_BORDER}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[stylesheet.ratingLabel, { color: theme.colors.MUTED }]}>
                {LABELS[rating] || 'Tap to rate'}
              </Text>
            </View>

            <View style={stylesheet.section}>
              <Text style={[stylesheet.sectionLabel, { color: theme.colors.MUTED }]}>
                YOUR REVIEW (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  stylesheet.textArea,
                  {
                    backgroundColor: theme.colors.SURFACE,
                    borderColor: theme.colors.GLASS_BORDER,
                    color: theme.colors.TEXT_PRIMARY,
                  },
                ]}
                value={comment}
                onChangeText={setComment}
                placeholder="Share your experience with this seller..."
                placeholderTextColor={theme.colors.MUTED}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[stylesheet.charCount, { color: theme.colors.MUTED }]}>
                {comment.length}/500
              </Text>
            </View>

            <TouchableOpacity
              style={[
                stylesheet.submitBtn,
                { backgroundColor: theme.colors.G },
                (rating === 0 || submitting) && stylesheet.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={rating === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={stylesheet.submitText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 'bold' },
  scroll: { padding: 16 },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  itemImage: { width: 72, height: 72, borderRadius: 10 },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, justifyContent: 'center', gap: 8 },
  itemTitle: { fontSize: 15, fontWeight: 'bold' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: { backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 11, fontWeight: 'bold' },
  sellerName: { fontSize: 13 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  ratingLabel: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  textArea: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 110 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#BDBDBD' },
  submitText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  alreadyBox: { alignItems: 'center', paddingTop: 48, gap: 12 },
  alreadyTitle: { fontSize: 22, fontWeight: 'bold' },
  alreadySub: { fontSize: 15, textAlign: 'center' },
}));
