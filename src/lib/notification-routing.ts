type NotificationRouteInput = {
  type: string;
  relatedId?: string | null;
  data?: Record<string, any> | null;
};

const firstId = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.length > 0);

/** Resolve a notification row to a route that exists in the Expo app. */
export function getMobileNotificationDestination({ type, relatedId, data }: NotificationRouteInput): string {
  switch (type) {
    case 'friend_request':
    case 'friend_request_accepted':
    case 'friend_request_declined':
    case 'new_follower': {
      const profileId = firstId(data?.fromUserId, data?.from_user_id, relatedId);
      return profileId ? `/profile/${profileId}` : '/(tabs)/catalog?tab=Discover&mode=circle';
    }
    case 'message':
    case 'message_reaction':
    case 'marketplace_message': {
      const conversationId = firstId(data?.conversationId, data?.conversation_id, relatedId);
      return conversationId ? `/chat/${conversationId}` : '/(tabs)/messages';
    }
    case 'post_like':
    case 'post_comment':
    case 'post_share':
    case 'mention': {
      const postId = firstId(data?.postId, data?.post_id, relatedId);
      if (!postId) return '/(tabs)';
      return type === 'post_comment'
        ? `/posts/${postId}?focusComments=true`
        : `/posts/${postId}`;
    }
    case 'event_cancelled': {
      const eventId = firstId(data?.eventId, data?.event_id);
      if (eventId) return `/events/${eventId}`;
      if (firstId(data?.ticketId, data?.ticket_id)) return '/tickets';
      return relatedId ? `/events/${relatedId}` : '/(tabs)/catalog?tab=Events';
    }
    case 'event_invite':
    case 'event_reminder':
    case 'event_updated': {
      const eventId = firstId(data?.eventId, data?.event_id, relatedId);
      return eventId ? `/events/${eventId}` : '/(tabs)/catalog?tab=Events';
    }
    case 'ticket':
    case 'ticket_purchase':
    case 'ticket_confirmed':
    case 'event_rsvp':
      return '/tickets';
    case 'catalog_item_inquiry':
    case 'catalog_item_out_of_stock': {
      const businessId = firstId(data?.businessId, data?.business_id);
      const itemId = firstId(data?.itemId, data?.item_id, relatedId);
      if (businessId && itemId) return `/businesses/catalog/${itemId}`;
      return businessId ? `/businesses/${businessId}` : '/(tabs)/catalog';
    }
    case 'business_review_received': {
      const businessId = firstId(data?.businessId, data?.business_id, relatedId);
      return businessId ? `/businesses/${businessId}` : '/(tabs)/catalog';
    }
    case 'booking_requested':
    case 'booking_confirmed':
    case 'booking_cancelled':
    case 'booking_no_show':
    case 'appeal_decided': {
      const bookingId = firstId(data?.bookingId, data?.booking_id, relatedId);
      return bookingId ? `/bookings/${bookingId}` : '/bookings';
    }
    case 'quote_estimated':
    case 'quote_converted':
      return '/bookings';
    case 'marketplace_item_sold':
    case 'marketplace_item_interest': {
      const itemId = firstId(data?.itemId, data?.item_id, relatedId);
      return itemId ? `/marketplace/${itemId}` : '/(tabs)/catalog?tab=Marketplace';
    }
    case 'payment_successful':
    case 'payment_refunded':
    case 'item_shipped':
    case 'delivery_confirmed':
    case 'funds_released': {
      const transactionId = firstId(data?.transactionId, data?.transaction_id, relatedId);
      return transactionId ? `/transactions/${transactionId}` : '/transactions';
    }
    case 'dispute_opened':
    case 'dispute_resolved': {
      const disputeId = firstId(data?.disputeId, data?.dispute_id, relatedId);
      return disputeId ? `/disputes/${disputeId}` : '/disputes';
    }
    case 'payout_processed':
    case 'payout_failed':
      return '/settings/payout-settings';
    case 'safety_alert':
    case 'alert': {
      const alertId = firstId(data?.id, data?.alertId, data?.alert_id, relatedId);
      return alertId ? `/alert/${alertId}` : '/alerts';
    }
    default:
      return '/(tabs)';
  }
}

/** Translate web notification URLs into Expo Router destinations. */
export function translateNotificationUrl(url: string): string {
  if (!url || url === '/') return '/(tabs)';
  if (url === '/community') return '/(tabs)/catalog?tab=Discover&mode=circle';
  if (url === '/messages') return '/(tabs)/messages';
  if (url.startsWith('/messages/')) return `/chat/${url.split('/')[2]}`;
  if (url === '/home') return '/(tabs)';
  if (url.startsWith('/events/')) return `/events/${url.split('/')[2]}`;
  if (url === '/events') return '/(tabs)/catalog?tab=Events';
  if (url.startsWith('/businesses/') && url.includes('/catalog/')) {
    return `/businesses/catalog/${url.split('/catalog/')[1]?.split(/[?#]/)[0]}`;
  }
  if (url.startsWith('/businesses/')) return `/businesses/${url.split('/')[2]?.split(/[?#]/)[0]}`;
  if (url === '/my-tickets') return '/tickets';
  if (url === '/marketplace') return '/(tabs)/catalog?tab=Marketplace';
  if (url.startsWith('/alerts/')) return `/alert/${url.split('/')[2]?.split(/[?#]/)[0]}`;
  if (url === '/alerts') return '/alerts';
  if (url === '/profile/payout-settings') return '/settings/payout-settings';
  if (url.startsWith('/')) return url;
  return '/(tabs)';
}
