import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function TicketScannerScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = params.eventId;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    ticket?: any;
  } | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const verifyTicketCode = async (code: string) => {
    if (!code || verifying) return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Fetch ticket by ID or code
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(
          `
          *,
          buyer:users!tickets_buyer_id_fkey(name, avatar_url, email),
          event:events!tickets_event_id_fkey(id, title, organizer_id),
          tier:ticket_tiers(name, price)
        `
        )
        .or(`id.eq.${cleanCode},ticket_code.eq.${cleanCode}`)
        .maybeSingle();

      if (error || !ticket) {
        setLastResult({ success: false, message: 'Invalid Ticket. Code not found in database.' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // 2. Verify organizer authorization if eventId filter is provided
      if (eventId && ticket.event_id !== eventId) {
        setLastResult({ success: false, message: 'Ticket belongs to a different event.' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (user && ticket.event?.organizer_id && ticket.event.organizer_id !== user.id) {
        setLastResult({
          success: false,
          message: 'Unauthorized: You are not the organizer of this event.',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // 3. Check if ticket is already checked in
      if (ticket.status === 'USED' || ticket.is_used || ticket.checked_in) {
        const timeStr = ticket.checked_in_at
          ? new Date(ticket.checked_in_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'earlier';
        setLastResult({
          success: false,
          message: `ALREADY SCANNED!\nThis ticket was checked in at ${timeStr}.`,
          ticket,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      // 4. Mark ticket as checked in / used
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'USED',
          is_used: true,
          checked_in: true,
          checked_in_at: nowIso,
        })
        .eq('id', ticket.id);

      if (updateError) {
        throw updateError;
      }

      setLastResult({
        success: true,
        message: `VALID TICKET!\nAttendee: ${ticket.buyer?.name || 'Attendee'}\nTier: ${ticket.tier?.name || 'General Admission'}`,
        ticket,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('Verify ticket error:', e);
      setLastResult({ success: false, message: e.message || 'Error verifying ticket.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);
    verifyTicketCode(data);
  };

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      {/* Header */}
      <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>
          Scan Attendee Tickets
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={stylesheet.content}>
        {/* Camera View */}
        {permission?.granted ? (
          <View style={stylesheet.cameraFrame}>
            <CameraView
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'pdf417'] }}
            />
            <View style={stylesheet.scanTarget} />
            <Text style={stylesheet.scanNotice}>Position ticket QR code inside the box</Text>
          </View>
        ) : (
          <View style={[stylesheet.noPermBox, { backgroundColor: theme.colors.SURFACE }]}>
            <Ionicons name="camera-outline" size={48} color={theme.colors.MUTED} />
            <Text style={[stylesheet.noPermText, { color: theme.colors.TEXT_PRIMARY }]}>
              Camera Permission Required
            </Text>
            <TouchableOpacity
              style={[stylesheet.permBtn, { backgroundColor: theme.colors.G }]}
              onPress={requestPermission}
            >
              <Text style={stylesheet.permBtnText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan Result Alert Banner */}
        {lastResult && (
          <View
            style={[
              stylesheet.resultCard,
              { backgroundColor: lastResult.success ? '#166534' : '#991B1B' },
            ]}
          >
            <Ionicons
              name={lastResult.success ? 'checkmark-circle' : 'alert-circle'}
              size={32}
              color={theme.colors.TEXT_PRIMARY}
            />
            <View style={{ flex: 1 }}>
              <Text style={stylesheet.resultTitle}>
                {lastResult.success ? 'Entry Approved ✅' : 'Verification Alert ⚠️'}
              </Text>
              <Text style={stylesheet.resultBody}>{lastResult.message}</Text>
            </View>
            {scanned && (
              <TouchableOpacity
                style={stylesheet.rescanBtn}
                onPress={() => {
                  setScanned(false);
                  setLastResult(null);
                }}
              >
                <Text style={stylesheet.rescanBtnText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual Code Input */}
        <View
          style={[
            stylesheet.manualCard,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
          ]}
        >
          <Text style={[stylesheet.manualTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Enter Ticket Code Manually
          </Text>
          <View style={stylesheet.inputRow}>
            <TextInput
              style={[
                stylesheet.input,
                {
                  color: theme.colors.TEXT_PRIMARY,
                  borderColor: theme.colors.GLASS_BORDER,
                  backgroundColor: theme.colors.SURFACE,
                },
              ]}
              placeholder="e.g. tkt_9f2a41..."
              placeholderTextColor={theme.colors.MUTED}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[stylesheet.verifyBtn, { backgroundColor: theme.colors.G }]}
              onPress={() => verifyTicketCode(manualCode)}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color={theme.colors.DARK} size="small" />
              ) : (
                <Text style={stylesheet.verifyBtnText}>Check</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { flex: 1, padding: 16, gap: 16 },
  cameraFrame: {
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.DARK,
    position: 'relative',
  },
  scanTarget: { width: 200, height: 200, borderWidth: 3, borderColor: '#82DB7E', borderRadius: 16 },
  scanNotice: {
    position: 'absolute',
    bottom: 16,
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  noPermBox: {
    height: 260,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  noPermText: { fontSize: 16, fontWeight: '700' },
  permBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
  },
  resultTitle: { color: theme.colors.TEXT_PRIMARY, fontWeight: '800', fontSize: 16 },
  resultBody: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  rescanBtn: {
    backgroundColor: theme.colors.TEXT_PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  rescanBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  manualCard: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 10 },
  manualTitle: { fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  verifyBtn: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
}));
