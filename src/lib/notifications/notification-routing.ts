type NotificationRouteInput = {
  type: string;
  relatedId?: string | null;
  data?: Record<string, any> | null;
};

const firstId = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.length > 0);

/** Resolve a notification row to a route that exists in the Expo app. */
export function getMobileNotificationDestination({
  type,
  relatedId,
  data,
}: NotificationRouteInput): string {
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
      return type === 'post_comment' ? `/posts/${postId}?focusComments=true` : `/posts/${postId}`;
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
    case 'booking_declined':
    case 'booking_cancelled':
    case 'booking_late_cancelled':
    case 'booking_no_show':
    case 'booking_reminder':
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
    case 'community_update':
      return '/(tabs)/catalog?tab=Discover&mode=circle';
    case 'welcome':
    case 'system_announcement':
      return '/notifications';
    case 'profile_view': {
      const profileId = firstId(data?.fromUserId, data?.from_user_id, relatedId);
      return profileId ? `/profile/${profileId}` : '/notifications';
    }
    case 'safety_alert':
    case 'alert': {
      const alertId = firstId(data?.id, data?.alertId, data?.alert_id, relatedId);
      return alertId ? `/alert/${alertId}` : '/alerts';
    }
    default:
      return '/(tabs)';
  }
}

/** Resolve a push payload, preferring an explicit destination and falling back to its type. */
export function getPushNotificationDestination(data: Record<string, unknown>): string {
  const url = data.url;
  if (typeof url === 'string' && url.trim() && url !== '/') {
    return translateNotificationUrl(url);
  }

  return getMobileNotificationDestination({
    type: typeof data.type === 'string' ? data.type : '',
    relatedId: typeof data.relatedId === 'string' ? data.relatedId : undefined,
    data,
  });
}

export function addNotificationId(destination: string, notificationId?: string): string {
  if (!notificationId) return destination;
  const separator = destination.includes('?') ? '&' : '?';
  return `${destination}${separator}notificationId=${encodeURIComponent(notificationId)}`;
}

export function getNotificationTarget(data: Record<string, unknown>): {
  table: string;
  id: string;
  fallback: string;
} | null {
  const type = typeof data.type === 'string' ? data.type : '';
  const id = firstId(
    data.fromUserId,
    data.from_user_id,
    data.conversationId,
    data.conversation_id,
    data.postId,
    data.post_id,
    data.eventId,
    data.event_id,
    data.itemId,
    data.item_id,
    data.bookingId,
    data.booking_id,
    data.transactionId,
    data.transaction_id,
    data.disputeId,
    data.dispute_id,
    data.businessId,
    data.business_id,
    data.alertId,
    data.alert_id,
    data.id,
    data.relatedId
  );
  if (!id) return null;

  if (['message', 'message_reaction', 'marketplace_message'].includes(type)) {
    return { table: 'conversations', id, fallback: '/(tabs)/messages' };
  }
  if (
    [
      'friend_request',
      'friend_request_accepted',
      'friend_request_declined',
      'new_follower',
      'profile_view',
    ].includes(type)
  ) {
    return { table: 'public_profiles', id, fallback: '/(tabs)/catalog?tab=Discover&mode=circle' };
  }
  if (['post_like', 'post_comment', 'post_share', 'mention'].includes(type)) {
    return { table: 'posts', id, fallback: '/(tabs)' };
  }
  if (['event_cancelled', 'event_invite', 'event_reminder', 'event_updated'].includes(type)) {
    return { table: 'events', id, fallback: '/(tabs)/catalog?tab=Events' };
  }
  if (['catalog_item_inquiry', 'catalog_item_out_of_stock'].includes(type)) {
    return { table: 'catalog_items', id, fallback: '/(tabs)/catalog' };
  }
  if (['marketplace_item_sold', 'marketplace_item_interest'].includes(type)) {
    return { table: 'posts', id, fallback: '/(tabs)/catalog?tab=Marketplace' };
  }
  if (type === 'business_review_received') {
    return { table: 'businesses', id, fallback: '/(tabs)/catalog' };
  }
  if (type.startsWith('booking_') || type === 'appeal_decided') {
    return { table: 'bookings', id, fallback: '/bookings' };
  }
  if (
    [
      'payment_successful',
      'payment_refunded',
      'item_shipped',
      'delivery_confirmed',
      'funds_released',
    ].includes(type)
  ) {
    return { table: 'escrow_transactions', id, fallback: '/transactions' };
  }
  if (type.startsWith('dispute_')) return { table: 'disputes', id, fallback: '/disputes' };
  if (['ticket', 'ticket_purchase', 'ticket_confirmed', 'event_rsvp'].includes(type)) {
    const ticketId = firstId(data.ticketId, data.ticket_id);
    return ticketId ? { table: 'tickets', id: ticketId, fallback: '/tickets' } : null;
  }
  if (type === 'safety_alert' || type === 'alert') {
    return { table: 'alerts', id, fallback: '/alerts' };
  }
  return null;
}

/** Suppress a foreground system banner only when the matching detail is visible. */
export function shouldSuppressForegroundNotification(
  data: Record<string, unknown>,
  pathname: string
): boolean {
  const type = typeof data.type === 'string' ? data.type : '';
  const conversationId = firstId(data.conversationId, data.conversation_id);
  if (
    ['message', 'message_reaction', 'marketplace_message', 'catalog_item_inquiry'].includes(type) &&
    conversationId
  ) {
    return pathname === `/chat/${conversationId}`;
  }

  if (
    [
      'payment_successful',
      'payment_refunded',
      'item_shipped',
      'delivery_confirmed',
      'funds_released',
    ].includes(type)
  ) {
    const transactionId = firstId(data.transactionId, data.transaction_id, data.relatedId);
    return transactionId
      ? pathname === `/transactions/${transactionId}`
      : pathname === '/transactions';
  }

  if (['dispute_opened', 'dispute_resolved'].includes(type)) {
    const disputeId = firstId(data.disputeId, data.dispute_id, data.relatedId);
    return disputeId ? pathname === `/disputes/${disputeId}` : pathname === '/disputes';
  }

  return false;
}

/** Translate web notification URLs into Expo Router destinations. */
export function translateNotificationUrl(url: string): string {
  if (!url || url === '/') return '/(tabs)';

  try {
    const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(url);
    const parsed = new URL(url, 'https://app.yrdly.ng');
    if (isAbsoluteUrl && parsed.hostname !== 'app.yrdly.ng') return '/(tabs)';

    const path = parsed.pathname.replace(/\/$/, '') || '/';
    const suffix = `${parsed.search}${parsed.hash}`;
    const withSuffix = (route: string) => `${route}${suffix}`;
    if (path === '/community') return '/(tabs)/catalog?tab=Discover&mode=circle';
    if (path === '/messages') return '/(tabs)/messages';
    const messageMatch = path.match(/^\/messages\/([^/]+)$/);
    if (messageMatch) return withSuffix(`/chat/${messageMatch[1]}`);
    if (path === '/home') return '/(tabs)';
    if (path === '/events') return '/(tabs)/catalog?tab=Events';
    const eventMatch = path.match(/^\/events\/([^/]+)$/);
    if (eventMatch) return withSuffix(`/events/${eventMatch[1]}`);
    const catalogMatch = path.match(/^\/businesses\/([^/]+)\/catalog\/([^/]+)$/);
    if (catalogMatch) return withSuffix(`/businesses/catalog/${catalogMatch[2]}`);
    const businessMatch = path.match(/^\/businesses\/([^/]+)$/);
    if (businessMatch) return withSuffix(`/businesses/${businessMatch[1]}`);
    if (path === '/my-tickets') return '/tickets';
    if (path === '/marketplace') return '/(tabs)/catalog?tab=Marketplace';
    const alertMatch = path.match(/^\/alerts\/([^/]+)$/);
    if (alertMatch) return withSuffix(`/alert/${alertMatch[1]}`);
    if (path === '/alerts') return '/alerts';
    if (path === '/profile/payout-settings') return '/settings/payout-settings';
    if (path.startsWith('/')) return withSuffix(path);
    return '/(tabs)';
  } catch {
    return '/(tabs)';
  }
}
