import { supabase } from './supabase';

export class UserReviewService {
  /**
   * Check if a buyer can review a seller based on a transaction
   */
  static async canUserReviewSeller(
    userId: string,
    sellerId: string,
    transactionId: string
  ): Promise<{ canReview: boolean; reason?: string }> {
    try {
      // Check if transaction exists and is completed
      const { data: transaction, error: transactionError } = await supabase
        .from('escrow_transactions')
        .select('id, buyer_id, seller_id, status')
        .eq('id', transactionId)
        .single();

      if (transactionError || !transaction) {
        return { canReview: false, reason: 'Transaction not found' };
      }

      // Check if user is the buyer
      if (transaction.buyer_id !== userId) {
        return { canReview: false, reason: 'Only buyers can review the seller' };
      }

      // Check if the seller matches
      if (transaction.seller_id !== sellerId) {
        return { canReview: false, reason: 'Seller mismatch' };
      }

      // Check if transaction is completed
      if (transaction.status !== 'completed' && transaction.status !== 'delivered') {
        return { canReview: false, reason: 'Transaction must be completed' };
      }

      // Check if user already reviewed this transaction
      const { data: existingReview } = await supabase
        .from('user_reviews')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('buyer_id', userId)
        .maybeSingle();

      if (existingReview) {
        return { canReview: false, reason: 'Already reviewed' };
      }

      return { canReview: true };
    } catch (error) {
      console.error('Error checking user review eligibility:', error);
      return { canReview: false, reason: 'Error checking eligibility' };
    }
  }

  /**
   * Submit a review for a seller
   */
  static async submitReview(
    sellerId: string,
    buyerId: string,
    transactionId: string,
    rating: number,
    comment?: string
  ): Promise<string> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const { canReview, reason } = await this.canUserReviewSeller(
        buyerId,
        sellerId,
        transactionId
      );

      if (!canReview) {
        throw new Error(reason || 'Cannot review this seller');
      }

      const { data, error } = await supabase
        .from('user_reviews')
        .insert({
          seller_id: sellerId,
          buyer_id: buyerId,
          transaction_id: transactionId,
          verified_purchase: true,
          rating,
          comment: comment || '',
        })
        .select('id')
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Error submitting user review:', error);
      throw new Error('Failed to submit review');
    }
  }

  /**
   * Get all reviews for a seller
   */
  static async getSellerReviews(sellerId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(
          `
          *,
          buyer:public_profiles!user_reviews_buyer_id_fkey(
            id,
            name,
            avatar_url
          )
        `
        )
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching seller reviews:', error);
      return [];
    }
  }
}
