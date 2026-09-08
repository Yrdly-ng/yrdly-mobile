import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '../lib/alert-service';
import {
  getSeverityTier,
  getAlertLabel,
  isResolved as checkIsResolved,
  formatAlertDate,
} from '../constants/alerts';
import { SeverityStrip } from './alerts/SeverityStrip';

interface AlertBannerProps {
  alert: Alert;
  onPress: () => void;
  onDismiss?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onPress, onDismiss }) => {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

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

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        stylesheet.container,
        {
          backgroundColor: resolved ? theme.colors.SURFACE_ALT : c.bg,
          borderColor: resolved ? theme.colors.GLASS_BORDER : c.border,
          opacity: resolved ? 0.6 : 1,
        },
      ]}
    >
      <SeverityStrip tier={tier} isResolved={resolved} width={5} />

      <View style={stylesheet.innerWrapper}>
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

        <View style={stylesheet.content}>
          <View style={stylesheet.headerRow}>
            <Text
              style={[
                stylesheet.type,
                { color: resolved ? theme.colors.LABEL : c.text },
              ]}
            >
              {getAlertLabel(alert)}
            </Text>
            <Text style={stylesheet.time}>{formatAlertDate(alert.created_at)}</Text>
          </View>

          <Text
            style={[
              stylesheet.title,
              { color: resolved ? theme.colors.MUTED : theme.colors.TEXT_PRIMARY },
            ]}
            numberOfLines={1}
          >
            {alert.title}
          </Text>

          <View style={stylesheet.locationRow}>
            <Ionicons name="location-outline" size={13} color={theme.colors.LABEL} />
            <Text style={stylesheet.area} numberOfLines={1}>
              {alert.last_seen_address || alert.area || 'Unknown Location'}
            </Text>
          </View>
        </View>

        {resolved && (
          <View style={stylesheet.resolvedBadge}>
            <Text style={stylesheet.resolvedText}>Resolved</Text>
          </View>
        )}

        {onDismiss && !resolved && (
          <TouchableOpacity
            style={stylesheet.dismissButton}
            onPress={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close" size={16} color={theme.colors.LABEL} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  innerWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  type: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
  },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  area: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
    flex: 1,
  },
  resolvedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(130,219,126,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.15)',
    flexShrink: 0,
    alignSelf: 'center',
  },
  resolvedText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 10,
    color: theme.colors.G,
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 2,
  },
}));
