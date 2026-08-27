import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { SafetyAlert } from '../../types';
import { PushNotificationService } from '../../lib/push-notification-service';

export default function SafetyAlertsScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);
  const router = useRouter();

  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    fetchAlerts();
  }, [view]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase.from('safety_alerts').select(`
          *,
          user:users (id, name, avatar_url)
        `);

      if (view === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['approved', 'rejected', 'resolved']);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data as SafetyAlert[]) || []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch safety alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (alert: SafetyAlert) => {
    try {
      const { error } = await supabase
        .from('safety_alerts')
        .update({ status: 'approved' })
        .eq('id', alert.id);

      if (error) throw error;

      // Remove from UI
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));

      // Trigger push notification to affected area users
      // Query users in the affected LGA/State
      let query = supabase.from('users').select('id');
      if (alert.lga) {
        query = query.eq('lga', alert.lga);
      } else if (alert.state) {
        query = query.eq('state', alert.state);
      }

      const { data: usersToNotify } = await query;

      if (usersToNotify && usersToNotify.length > 0) {
        const userIds = usersToNotify.map((u) => u.id);
        await PushNotificationService.sendToUsers(userIds, {
          title: `⚠️ ${alert.type.toUpperCase()}: ${alert.title}`,
          body: alert.description,
          type: 'safety_alert',
        });
      }

      Alert.alert('Approved', 'Alert published and notifications sent.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve alert');
    }
  };

  const handleReject = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('safety_alerts')
        .update({ status: 'rejected' })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to reject alert');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Safety Alerts</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, view === 'pending' && s.tabActive]}
          onPress={() => setView('pending')}
        >
          <Text style={[s.tabText, view === 'pending' && s.tabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, view === 'history' && s.tabActive]}
          onPress={() => setView('history')}
        >
          <Text style={[s.tabText, view === 'history' && s.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.emptyState}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {alerts.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.iconCircle}>
                <Feather name="check-circle" size={32} color={theme.colors.G} />
              </View>
              <Text style={s.emptyTitle}>
                {view === 'pending' ? 'All Caught Up!' : 'No History'}
              </Text>
              <Text style={s.emptySub}>
                {view === 'pending'
                  ? 'There are no pending safety alerts to review.'
                  : 'You have not approved or rejected any alerts yet.'}
              </Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <View
                key={alert.id}
                style={[s.alertCard, alert.status === 'rejected' && { opacity: 0.6 }]}
              >
                <View style={s.alertHeader}>
                  <Text style={s.alertType}>{alert.type.toUpperCase()}</Text>
                  <Text
                    style={[
                      s.alertSeverity,
                      alert.severity === 'urgent' && { color: theme.colors.DANGER },
                    ]}
                  >
                    {alert.severity.toUpperCase()}
                  </Text>
                </View>
                <Text style={s.alertTitle}>{alert.title}</Text>
                <Text style={s.alertDesc}>{alert.description}</Text>
                <Text style={s.alertArea}>📍 {alert.area_name}</Text>
                <Text style={s.alertSub}>Submitted by: {alert.user?.name || 'Unknown'}</Text>

                {alert.status === 'pending' ? (
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={[s.btn, s.btnReject]}
                      onPress={() => handleReject(alert.id)}
                    >
                      <Text style={s.btnTextReject}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.btn, s.btnApprove]}
                      onPress={() => handleApprove(alert)}
                    >
                      <Text style={s.btnTextApprove}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.statusBadge}>
                    <Text style={s.statusBadgeText}>STATUS: {alert.status.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#fff' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE_ALT,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.G,
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: theme.colors.LABEL,
  },
  tabTextActive: {
    color: theme.colors.G,
    fontFamily: 'Inter-SemiBold',
  },
  content: { padding: 20, paddingBottom: 60 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, flex: 1 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },

  alertCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  alertType: { fontFamily: 'Outfit-SemiBold', fontSize: 12, color: theme.colors.G },
  alertSeverity: { fontFamily: 'Outfit-Bold', fontSize: 12, color: theme.colors.WARNING },
  alertTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  alertDesc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.TEXT_SECONDARY,
    marginBottom: 12,
  },
  alertArea: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  alertSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, marginBottom: 16 },

  actionRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnReject: { backgroundColor: 'transparent', borderColor: theme.colors.GLASS_BORDER },
  btnApprove: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  btnTextReject: { fontFamily: 'Outfit-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  btnTextApprove: { fontFamily: 'Outfit-SemiBold', fontSize: 14, color: theme.colors.DARK },
}));
