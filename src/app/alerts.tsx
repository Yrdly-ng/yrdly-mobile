import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertService, Alert } from '../lib/alert-service';
import { AlertBanner } from '../components/AlertBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
type SeverityFilter = 'all' | 'urgent' | 'caution' | 'information';

const FILTERS: { key: SeverityFilter; label: string; color: string; bg: string }[] = [
  { key: 'all', label: 'All', color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)' },
  { key: 'urgent', label: 'Urgent', color: '#EF4444', bg: 'rgba(183,28,28,0.18)' },
  { key: 'caution', label: 'Caution', color: '#FFB74D', bg: 'rgba(230,81,0,0.15)' },
  { key: 'information', label: 'Info', color: '#64B5F6', bg: 'rgba(33,150,243,0.12)' },
];

export default function AlertsScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>('all');

  const fetchAlerts = useCallback(async () => {
    const fetchedAlerts = await AlertService.getActiveAlerts();
    setAlerts(fetchedAlerts);
  }, []);

  useEffect(() => {
    fetchAlerts().then(() => setLoading(false));
  }, [fetchAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const filtered = useMemo(
    () =>
      activeFilter === 'all' ? alerts : alerts.filter((a: any) => a.severity === activeFilter),
    [alerts, activeFilter]
  );

  const sections = useMemo(() => {
    const active = filtered.filter((a: any) => a.status !== 'resolved'); // default to active if missing
    const resolved = filtered.filter((a: any) => a.status === 'resolved');
    const result = [];
    if (active.length > 0) result.push({ title: `ACTIVE · ${active.length}`, data: active });
    if (resolved.length > 0)
      result.push({ title: `RESOLVED · ${resolved.length}`, data: resolved });
    return result;
  }, [filtered]);

  return (
    <View
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.GLASS_BORDER,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34,
            height: 34,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 11,
            backgroundColor: theme.colors.SURFACE,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Outfit',
              fontWeight: '700',
              fontSize: 18,
              color: theme.colors.TEXT_PRIMARY,
            }}
          >
            Safety Alerts
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL }}>
            Victoria Island & Lekki, Lagos
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: 'rgba(239,68,68,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.25)',
          }}
        >
          <Text style={{ fontFamily: 'Outfit', fontWeight: '700', fontSize: 11, color: '#ef4444' }}>
            {alerts.filter((a) => a.status !== 'resolved').length} ACTIVE
          </Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => {
          return <Text style={stylesheet.sectionHeader}>{title}</Text>;
        }}
        renderItem={({ item }) => {
          return (
            <View style={{ paddingHorizontal: 20 }}>
              <AlertBanner alert={item} onPress={() => router.push(`/alert/${item.id}` as any)} />
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.G}
            colors={[theme.colors.G]}
          />
        }
        contentContainerStyle={stylesheet.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={stylesheet.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.colors.MUTED} />
              <Text style={[stylesheet.emptyText, { color: theme.colors.LABEL }]}>
                {activeFilter === 'all'
                  ? 'There are no active alerts in your area.'
                  : `No ${activeFilter} alerts right now.`}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  listContent: { paddingVertical: 16, paddingBottom: 32 },
  sectionHeader: {
    fontFamily: 'Inter',
    fontWeight: '700',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 1.1,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 10,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
}));
