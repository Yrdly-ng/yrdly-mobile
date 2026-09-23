// Types for Yrdly — backed by Supabase

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Location {
  address: string;
  geopoint?: GeoPoint;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  location: Location;
  image_urls?: string[];
  created_at: string;
  location_geom?: string | null;
  state?: string | null;
  lga?: string | null;
  ward?: string | null;
  lat?: number | null;
  lng?: number | null;
  rating?: number;
  review_count?: number;
  view_count?: number;
  followers_count?: number;
  hours?: string;
  phone?: string;
  email?: string;
  website?: string;
  owner_name?: string;
  owner_avatar?: string;
  cover_image?: string;
  logo?: string;
  logo_url?: string;
  distance?: string;
  catalog?: CatalogItem[];
  mode?: BusinessMode;
  no_show_count?: number;
  late_cancellation_count?: number;
  is_flagged?: boolean;
}

export interface CatalogItem {
  id: string;
  business_id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  in_stock: boolean;
  quantity?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessMessage {
  id: string;
  business_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  timestamp: string;
  is_read: boolean;
  liked_by: string[];
  visibility?: string;
  is_private?: boolean;
  item_id?: string;
  created_at?: string;
}

export interface BusinessReview {
  id: string;
  business_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  rating: number;
  comment: string;
  created_at: string;
  transaction_id?: string;
  verified_purchase?: boolean;
}

export type PostCategory =
  | 'General'
  | 'Event'
  | 'For Sale'
  | 'Selling'
  | 'Wanted'
  | 'Request'
  | 'Recommendation'
  | 'Giveaway'
  | 'Business';

export interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_image?: string;
  text: string;
  description?: string;
  image_url?: string;
  image_urls?: string[];
  image_width?: number | null;
  image_height?: number | null;
  video_urls?: string[];
  video_thumbnail_url?: string | null;
  timestamp: string;
  comment_count: number;
  category: PostCategory;
  state?: string | null;
  lga?: string | null;
  ward?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_geom?: string | null;
  title?: string;
  event_date?: string;
  event_time?: string;
  event_link?: string;
  event_location?: Location;
  attendees?: string[];
  price?: number;
  condition?: string;
  sub_category?: string;
  negotiable?: boolean;
  view_count?: number;
  is_sold?: boolean;
  liked_by: string[];
  visibility?: string;
  is_private?: boolean;
  share_count?: number;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
    location?: {
      state?: string;
      lga?: string;
      ward?: string;
    };
    home_state?: string | null;
    home_lga?: string | null;
    home_ward?: string | null;
    home_lat?: number | null;
    home_lng?: number | null;
    home_location_geom?: string | null;
    created_at?: string;
  };
  moderation_status?: 'pending' | 'approved' | 'rejected' | null;
}

export interface Comment {
  id: string;
  userId: string;
  authorName: string;
  authorImage: string;
  text: string;
  timestamp: string;
  parentId: string | null;
  reactions: { [key: string]: string[] };
}

export interface User {
  id: string;
  uid: string;
  name: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  location?: {
    state?: string;
    lga?: string;
    city?: string;
    ward?: string;
  };
  home_state?: string | null;
  home_lga?: string | null;
  home_ward?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  home_location_geom?: string | null;
  friends?: string[];
  blockedUsers?: string[];
  interests?: string[];
  current_location?: {
    lat: number;
    lng: number;
    geopoint?: GeoPoint;
  };
  share_location?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
    lastUpdated: string;
  };
  created_at?: string;
  review_count?: number;
  rating?: number;
  phone_verified?: boolean;
  locationUpdatedAt?: string;
  notificationSettings?: NotificationSettings;
  timestamp?: string;
  isOnline?: boolean;
  lastSeen?: string;
  no_show_count?: number;
  late_cancellation_count?: number;
  is_flagged?: boolean;
}

export type BusinessMode = 'product' | 'service' | 'both';

export interface ServiceOffering {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price?: number;
  price_is_from: boolean;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderAvailability {
  id: string;
  business_id: string;
  day_of_week: number; // 0 = Sun, 6 = Sat
  start_time: string; // HH:mm format
  end_time: string;   // HH:mm format
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityException {
  id: string;
  business_id: string;
  date: string; // YYYY-MM-DD
  is_blackout: boolean;
  custom_start_time?: string;
  custom_end_time?: string;
  reason?: string;
  created_at?: string;
}

export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'late_cancelled' | 'no_show';
export type StrikeType = 'late_cancellation' | 'no_show';
export type StrikeParty = 'customer' | 'provider';

export interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  service_id: string;
  appointment_time: string;
  end_time: string;
  status: BookingStatus;
  notes?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  strike_type?: StrikeType;
  strike_party?: StrikeParty;
  reminder_24h_sent?: boolean;
  reminder_2h_sent?: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  service?: ServiceOffering;
  business?: Business;
  customer?: {
    id: string;
    name: string;
    avatar_url?: string;
    phone?: string;
    is_flagged?: boolean;
    no_show_count?: number;
    late_cancellation_count?: number;
  };
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  participant_ids: string[];
  status: 'pending' | 'accepted' | 'declined';
  timestamp: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participant: User;
  lastMessage?: {
    id?: string;
    senderId: string;
    text: string;
    timestamp: string;
    isRead?: boolean;
    readBy?: string[];
  };
  messages: Message[];
  typing?: { [key: string]: boolean };
}

export interface Message {
  id: string;
  senderId: string;
  sender: User;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: string;
  isRead: boolean;
}

export interface SafetyAlert {
  id: string;
  user_id: string;
  title: string;
  description: string;
  severity: 'information' | 'caution' | 'urgent';
  type: 'safety' | 'amber' | 'info';
  area_name: string;
  state?: string;
  lga?: string;
  ward?: string;
  action?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface NotificationSettings {
  friendRequests: boolean;
  messages: boolean;
  postUpdates: boolean;
  comments: boolean;
  postLikes: boolean;
  eventInvites: boolean;
}

