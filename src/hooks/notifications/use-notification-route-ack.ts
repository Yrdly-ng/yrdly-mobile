import { useEffect } from 'react';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/hooks/use-supabase-auth';
import { NotificationService } from '@/lib/notifications/notification-service';
import {
  getNotificationTarget,
  getPushNotificationDestination,
} from '@/lib/notifications/notification-routing';
import { supabase } from '@/lib/supabase/supabase';

/** Mark a notification read only after its detail screen has loaded its target. */
export function useNotificationRouteAcknowledgement(targetLoaded: boolean) {
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    notificationId?: string | string[];
    targetUnavailable?: string | string[];
  }>();
  const notificationId = Array.isArray(params.notificationId)
    ? params.notificationId[0]
    : params.notificationId;
  const targetUnavailable = Array.isArray(params.targetUnavailable)
    ? params.targetUnavailable[0]
    : params.targetUnavailable;

  useEffect(() => {
    if (!targetLoaded || !notificationId || !user?.id) return;
    let active = true;
    const acknowledge = async () => {
      if (notificationId.startsWith('mapped_alert_')) {
        await SecureStore.setItemAsync(
          `yrdly_dismissed_alert_${notificationId.slice('mapped_alert_'.length)}`,
          '1'
        );
        if (active)
          router.setParams({ notificationId: undefined, targetUnavailable: undefined } as any);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('type, related_id, related_type, sender_id, data')
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !data || !active) return;
      const notificationData = {
        ...(data.data as Record<string, unknown>),
        type: data.type,
        relatedId: data.related_id,
        relatedType: data.related_type,
        fromUserId: data.sender_id,
      };
      const target = getNotificationTarget(notificationData);
      const expectedPath =
        targetUnavailable === '1' && target
          ? target.table === 'community_posts' && pathname === '/communities'
            ? '/communities'
            : target.fallback
          : getPushNotificationDestination(notificationData).split('?')[0];
      const normalizePath = (value: string) =>
        value.split(/[?#]/)[0].replace(/\/\([^/]+\)/g, '') || '/';
      if (normalizePath(pathname) !== normalizePath(expectedPath)) return;

      // Recheck existence after the detail route has loaded to avoid acknowledging
      // an item that disappeared between the route preflight and its own fetch.
      if (target && targetUnavailable !== '1') {
        const tables = target.table === 'alerts' ? ['alerts', 'safety_alerts'] : [target.table];
        let found = false;
        for (const table of tables) {
          const { data: row, error: targetError } = await supabase
            .from(table)
            .select('id')
            .eq('id', target.id)
            .maybeSingle();
          if (!targetError && row) {
            found = true;
            break;
          }
        }
        if (!found || !active) return;
      }

      const marked = await NotificationService.markAsRead(notificationId, user.id);
      if (marked && active)
        router.setParams({ notificationId: undefined, targetUnavailable: undefined } as any);
    };
    void acknowledge().catch((error) =>
      console.error('Notification acknowledgement failed:', error)
    );
    return () => {
      active = false;
    };
  }, [notificationId, pathname, targetLoaded, targetUnavailable, user?.id]);
}
