import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { NotificationService } from '@/lib/notification-service';

interface NotificationBadgeContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationBadgeContext = createContext<NotificationBadgeContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export const useNotificationBadge = () => useContext(NotificationBadgeContext);

export function NotificationBadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (!user) return;
    try {
      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (e) {
      console.error('Error fetching unread count:', e);
    }
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Initial fetch
    refreshUnreadCount();

    // Subscribe to realtime updates on the notifications table
    const channel = supabase
      .channel('global_notifications_badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          // Whenever a notification is inserted, updated, or deleted, refresh the count
          refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        refreshUnreadCount();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [user]);

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}
