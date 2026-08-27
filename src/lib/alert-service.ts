import { supabase } from './supabase';
import { AuthService } from './auth-service';

export interface Alert {
  id: string;
  type: 'amber' | 'missing_person' | 'community_safety';
  title: string;
  description: string;
  status?: 'active' | 'resolved' | 'expired';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  area?: string;
  subject_name?: string;
  subject_age?: number;
  subject_photo_url?: string;
  last_seen_location?: any; // Geography point
  last_seen_address?: string;
  radius_km: number;
  contact_info?: string;
  source: string;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
  created_by?: string;
  expires_at?: string;
}

export interface CreateAlertData extends Omit<
  Alert,
  'id' | 'created_at' | 'is_resolved' | 'last_seen_location'
> {
  lat?: number;
  lng?: number;
}

export class AlertService {
  /**
   * Fetches the most recent active alert.
   */
  static async getActiveAlert(): Promise<Alert | null> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active alert:', error);
        return null;
      }

      // Check if it's expired
      if (data && data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('getActiveAlert error:', error);
      return null;
    }
  }

  /**
   * Fetches all recent active alerts.
   */
  static async getActiveAlerts(): Promise<Alert[]> {
    try {
      const { data, error } = await supabase
        .from('safety_alerts')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active alerts:', error);
        return [];
      }

      if (data) {
        return data.map(
          (alert: any) =>
            ({
              id: alert.id,
              type: alert.type,
              title: alert.title,
              description: alert.description,
              severity: alert.severity,
              area: alert.area_name,
              source: 'user',
              is_resolved: false,
              created_at: alert.created_at,
              radius_km: 0,
            }) as Alert
        );
      }
      return [];
    } catch (error) {
      console.error('getActiveAlerts error:', error);
      return [];
    }
  }

  /**
   * Post a new alert (Admin only)
   */
  static async createAlert(alertData: CreateAlertData) {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      const profile = await AuthService.getUserProfile(currentUser.id);
      if (profile?.role !== 'admin' && !profile?.is_admin) {
        throw new Error('Not authorized to post alerts');
      }

      const { lat, lng, ...rest } = alertData;

      // Supabase PostGIS geometry format is typically WKT 'POINT(lng lat)'
      // But because last_seen_location is geography, we can pass it as a GeoJSON object or WKT point string if Supabase js client supports it.
      // Usually passing WKT string like `POINT(${lng} ${lat})` works perfectly.
      const last_seen_location =
        lat !== undefined && lng !== undefined ? `POINT(${lng} ${lat})` : null;

      const { data, error } = await supabase
        .from('alerts')
        .insert({
          ...rest,
          ...(last_seen_location ? { last_seen_location } : {}),
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;

      // We'll also call the notify-alert edge function manually just in case we don't use DB webhooks
      // Let's invoke it explicitly to be safe and fast for this phase
      supabase.functions
        .invoke('notify-alert', {
          body: { record: data },
        })
        .catch((err) => console.error('Failed to invoke notify-alert:', err));

      return { data, error: null };
    } catch (error) {
      console.error('createAlert error:', error);
      return { data: null, error };
    }
  }

  /**
   * Resolve an alert (Admin only)
   */
  static async resolveAlert(alertId: string) {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      const profile = await AuthService.getUserProfile(currentUser.id);
      if (profile?.role !== 'admin' && !profile?.is_admin) {
        throw new Error('Not authorized to resolve alerts');
      }

      const { error } = await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('resolveAlert error:', error);
      return { error };
    }
  }
}
