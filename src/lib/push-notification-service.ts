import { supabase } from './supabase';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  url?: string;
  type?: string;
}

export class PushNotificationService {
  /**
   * Send push notification to a specific user
   */
  static async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      const { type, ...restPayload } = payload;
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { userId, payload: restPayload, type },
      });

      if (error) {
        console.error('Edge function error:', error);
        return false;
      }

      return data?.success === true;
    } catch (error) {
      console.error('Error sending push notification via edge function:', error);
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<number> {
    let successCount = 0;
    for (const userId of userIds) {
      const success = await this.sendToUser(userId, payload);
      if (success) successCount++;
    }
    return successCount;
  }

  /**
   * Send push notification to all users
   */
  static async sendToAllUsers(payload: PushNotificationPayload): Promise<number> {
    console.log('[PushNotification] sendToAllUsers pending backend implementation for broadcast');
    return 0;
  }

  /**
   * Test push notification (for development)
   */
  static async testNotification(userId: string): Promise<boolean> {
    return this.sendToUser(userId, {
      title: 'Test Notification',
      body: 'This is a test push notification from Yrdly!',
      url: '/home',
    });
  }
}
