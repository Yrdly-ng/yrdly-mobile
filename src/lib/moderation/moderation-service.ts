import { api } from '../network/api';

export class ModerationService {
  /**
   * Check if a text is safe using the moderate-content Edge Function
   */
  static async checkText(text: string): Promise<{ isSafe: boolean; reason?: string }> {
    if (!text || text.trim() === '') return { isSafe: true };

    try {
      return await api.post('/api/moderation/check', { type: 'text', content: text });
    } catch (e) {
      console.error('[ModerationService] Exception checking text:', e);
      return { isSafe: false, reason: 'moderation_error' };
    }
  }
}
