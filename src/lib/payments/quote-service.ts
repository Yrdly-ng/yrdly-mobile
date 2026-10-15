import { isPaidPrice, MINIMUM_PRICE_MESSAGE } from '@/lib/marketplace/price-policy';
import { supabase } from '../supabase/supabase';
import type { QuoteRequest, QuoteMessage } from '../../types/index';

export class QuoteService {
  static async createQuoteRequest(p: {
    business_id: string;
    category: string;
    title: string;
    description: string;
    images?: string[];
    location_text?: string;
    urgency?: string;
    staff_id?: string | null;
  }): Promise<QuoteRequest> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('quote_requests')
      .insert([
        {
          customer_id: user.id,
          business_id: p.business_id,
          category: p.category,
          title: p.title,
          description: p.description,
          images: p.images || [],
          location_text: p.location_text,
          urgency: p.urgency,
          staff_id: p.staff_id || null,
        },
      ])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async listCustomerQuotes(): Promise<QuoteRequest[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async listBusinessQuotes(businessId: string): Promise<QuoteRequest[]> {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getQuote(id: string): Promise<QuoteRequest | null> {
    const { data, error } = await supabase.from('quote_requests').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  static async submitEstimate(
    id: string,
    p: {
      estimated_price: number;
      estimated_duration_minutes?: number;
      estimate_notes?: string;
      expires_at?: string;
    }
  ): Promise<QuoteRequest> {
    if (!isPaidPrice(p.estimated_price)) throw new Error(MINIMUM_PRICE_MESSAGE);
    const { data, error } = await supabase
      .from('quote_requests')
      .update({
        estimated_price: p.estimated_price,
        estimated_duration_minutes: p.estimated_duration_minutes,
        estimate_notes: p.estimate_notes,
        expires_at: p.expires_at,
        status: 'estimated',
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async updateStatus(id: string, status: string): Promise<QuoteRequest> {
    const { data, error } = await supabase
      .from('quote_requests')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async listMessages(quoteId: string): Promise<QuoteMessage[]> {
    const { data, error } = await supabase
      .from('quote_messages')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  static async sendMessage(quoteId: string, body: string): Promise<QuoteMessage> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('quote_messages')
      .insert([{ quote_id: quoteId, sender_id: user.id, body }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
}
