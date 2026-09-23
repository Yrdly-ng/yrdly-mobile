import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Alert } from '../../lib/alert-service';
import {
  getSeverityTier,
  getAlertLabel,
  isResolved as checkIsResolved,
  formatAlertDate,
} from '../../constants/alerts';
import { SeverityStrip } from '../../components/alerts/SeverityStrip';

export default function AlertDetailsScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlert = useCallback(async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from('safety_alerts').select('*').eq('id', id).single();

      if (!data) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('alerts')
          .select('*')
          .eq('id', id)
          .single();
        data = fallbackData;
        if (!data) error = fallbackError;
      }

      if (data) {
        setAlert({
          ...data,
          area: data.area_name || data.area,
          is_resolved: data.status === 'resolved' || data.is_resolved,
        });
      } else {
        console.error('Alert not found:', error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  if (loading) {
    return (
      <View
        style={[
          stylesheet.container,
          { backgroundColor: theme.colors.DARK, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  }

  if (!alert) {
    return (
      <View
        style={[
          stylesheet.container,
          { backgroundColor: theme.colors.DARK, paddingTop: insets.top },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 20,
            paddingVertical: 14,
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
        </View>
        <View style={stylesheet.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.MUTED} />
          <Text style={[stylesheet.emptyText, { color: theme.colors.LABEL }]}>
            Alert not found.
          </Text>
        </View>
      </View>
    );
  }

  const resolved = checkIsResolved(alert);
  const tier = getSeverityTier(alert);
  const c = theme.SEVERITY[tier];
  const isMissingPerson = Boolean(alert.subject_name || alert.subject_photo_url);

  let iconName: keyof typeof Ionicons.glyphMap = 'information-circle-outline';
  if (isMissingPerson) {
    iconName = 'body-outline';
  } else if (tier === 'urgent') {
    iconName = 'warning';
  } else if (tier === 'caution') {
    iconName = 'alert-circle-outline';
  }

  const extraBlocks = (
    <>
      {alert.subject_photo_url && (
        <Image
          source={{ uri: alert.subject_photo_url }}
          style={stylesheet.photo}
          resizeMode="cover"
        />
      )}

      {(alert.subject_name || alert.source) && (
        <View style={stylesheet.detailsCard}>
          {alert.subject_name && (
            <View style={stylesheet.infoRow}>
              <Feather name="user" size={18} color={theme.colors.LABEL} />
              <Text style={stylesheet.infoText}>
                {alert.subject_name} {alert.subject_age ? `(${alert.subject_age} years old)` : ''}
              </Text>
            </View>
          )}
          {alert.source && (
            <View style={stylesheet.infoRow}>
              <Feather name="info" size={18} color={theme.colors.LABEL} />
              <Text style={stylesheet.infoText}>Source: {alert.source}</Text>
            </View>
          )}
        </View>
      )}

      {alert.contact_info && (
        <TouchableOpacity
          style={[
            stylesheet.contactButton,
            { backgroundColor: resolved ? theme.colors.MUTED : c.icon },
          ]}
          onPress={() => Linking.openURL(`tel:${alert.contact_info}`)}
          disabled={resolved}
        >
          <Feather name="phone" size={18} color={theme.colors.TEXT_PRIMARY} />
          <Text style={stylesheet.contactButtonText}>Contact {alert.contact_info}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const descCardBlock = (
    <View style={stylesheet.descCard}>
      <Text style={stylesheet.descLabel}>What happened</Text>
      <Text style={stylesheet.descText}>{alert.description}</Text>
    </View>
  );

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
      </View>

      <ScrollView contentContainerStyle={stylesheet.content}>
        {resolved && (
          <View style={stylesheet.resolutionBanner}>
            <Feather name="check" size={16} color={theme.colors.G} />
            <Text style={stylesheet.resolutionText}>
              Resolved — This alert is no longer active.
            </Text>
          </View>
        )}

        {/* Hero */}
        <View
          style={[
            stylesheet.hero,
            {
              backgroundColor: resolved ? theme.colors.SURFACE_ALT : c.bg,
              borderColor: resolved ? theme.colors.GLASS_BORDER : c.border,
            },
          ]}
        >
          <SeverityStrip tier={tier} isResolved={resolved} width={6} />

          <View style={stylesheet.heroInner}>
            <View style={stylesheet.heroTopRow}>
              <View style={stylesheet.typeWrapper}>
                <View
                  style={[
                    stylesheet.iconCircle,
                    { backgroundColor: resolved ? theme.colors.SURFACE : c.bg },
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={15}
                    color={resolved ? theme.colors.LABEL : c.icon}
                  />
                </View>
                <Text
                  style={[stylesheet.typeText, { color: resolved ? theme.colors.LABEL : c.text }]}
                >
                  {getAlertLabel(alert)}
                </Text>
              </View>
              <Text style={stylesheet.timeText}>
                {formatAlertDate(alert.created_at)}
              </Text>
            </View>

            <Text
              style={[
                stylesheet.title,
                { color: resolved ? theme.colors.MUTED : theme.colors.TEXT_PRIMARY },
              ]}
            >
              {alert.title}
            </Text>

            <View style={stylesheet.heroBottomRow}>
              <Ionicons name="location-outline" size={13} color={theme.colors.LABEL} />
              <Text style={stylesheet.areaText}>
                {alert.last_seen_address || alert.area || 'Unknown Location'}
              </Text>
            </View>
          </View>
        </View>

        {isMissingPerson ? (
          <>
            {extraBlocks}
            {descCardBlock}
          </>
        ) : (
          <>
            {descCardBlock}
            {extraBlocks}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { fontFamily: 'Inter-Medium', fontSize: 16, marginTop: 16, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16, paddingTop: 8 },
  resolutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(130,219,126,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    borderRadius: 14,
  },
  resolutionText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 13,
    color: theme.colors.G,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  typeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 14,
  },
  timeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.LABEL,
  },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 8,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  areaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
  },
  descCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
  },
  descLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.LABEL,
    marginBottom: 8,
  },
  descText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.TEXT_SECONDARY,
    lineHeight: 25,
  },
  detailsCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    gap: 16,
  },
  photo: { width: '100%', height: 300, borderRadius: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontFamily: 'Inter-Medium', fontSize: 15, color: theme.colors.TEXT_PRIMARY, flex: 1 },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  contactButtonText: { fontFamily: 'Inter-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
}));
