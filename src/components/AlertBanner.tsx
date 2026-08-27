import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '../lib/alert-service';

interface AlertBannerProps {
  alert: Alert;
  onPress: () => void;
  onDismiss?: () => void;
}

const SEVERITY_COLORS = {
  urgent: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    text: '#ef4444',
    icon: '#ef4444',
  },
  caution: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    text: '#f59e0b',
    icon: '#f59e0b',
  },
  information: {
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    text: '#3b82f6',
    icon: '#3b82f6',
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onPress, onDismiss }) => {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const isResolved = alert.status === 'resolved';

  // Map severity to standard colors, defaulting to 'information'
  const severityKey = ['urgent', 'caution'].includes(alert.severity || '')
    ? (alert.severity as keyof typeof SEVERITY_COLORS)
    : 'information';
  const c = SEVERITY_COLORS[severityKey];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        stylesheet.container,
        {
          backgroundColor: isResolved ? '#0a0a0a' : c.bg,
          borderColor: isResolved ? theme.colors.GLASS_BORDER : c.border,
          opacity: isResolved ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name="warning-outline"
        size={18}
        color={isResolved ? theme.colors.LABEL : c.icon}
        style={{ marginTop: 2 }}
      />

      <View style={stylesheet.content}>
        <View style={stylesheet.headerRow}>
          <Text style={[stylesheet.type, { color: isResolved ? theme.colors.LABEL : c.text }]}>
            {alert.type || alert.severity || 'ALERT'}
          </Text>
          <Text style={stylesheet.time}>· {new Date(alert.created_at).toLocaleDateString()}</Text>
        </View>

        <Text
          style={[
            stylesheet.title,
            { color: isResolved ? theme.colors.MUTED : theme.colors.TEXT_PRIMARY },
          ]}
          numberOfLines={1}
        >
          {alert.title}
        </Text>

        <Text style={stylesheet.area} numberOfLines={1}>
          📍 {alert.last_seen_address || alert.area || 'Unknown Location'}
        </Text>
      </View>

      {isResolved && (
        <View style={stylesheet.resolvedBadge}>
          <Text style={stylesheet.resolvedText}>RESOLVED</Text>
        </View>
      )}

      {onDismiss && !isResolved && (
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
    </TouchableOpacity>
  );
};

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  type: {
    fontFamily: 'Outfit-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: theme.colors.LABEL,
  },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    marginBottom: 4,
  },
  area: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
  },
  resolvedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(130,219,126,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.15)',
    flexShrink: 0,
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
