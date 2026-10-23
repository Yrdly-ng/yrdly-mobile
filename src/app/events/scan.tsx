import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/network/api';
import { useAuth } from '../../hooks/use-supabase-auth';
import * as Haptics from 'expo-haptics';

export default function TicketScannerScreen() {
  const { theme } = useUnistyles();
  const stylesheet = _stylesheet;

  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = params.eventId;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const scanInFlight = useRef(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    ticket?: any;
  } | null>(null);

  const verifyTicketCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || scanInFlight.current) return;
    if (!user || !eventId) {
      setLastResult({
        success: false,
        message: 'Open the scanner from an event you organize and sign in again.',
      });
      return;
    }
    scanInFlight.current = true;
    setScanned(true);
    setVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // The server authorizes the organizer and atomically consumes a PAID ticket.
      const result = await api.post<{
        valid: boolean;
        attendee_name?: string;
        tier_name?: string;
        message?: string;
      }>('/api/events/checkin', { ticket_code: cleanCode, event_id: eventId });
      if (!result.valid) throw new Error(result.message || 'Ticket could not be validated.');
      setLastResult({
        success: true,
        message: `Attendee: ${result.attendee_name || 'Attendee'}\nTier: ${result.tier_name || 'General Admission'}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setLastResult({
        success: false,
        message: error.message || 'Ticket could not be validated. Please try again.',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      scanInFlight.current = false;
      setVerifying(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);
    verifyTicketCode(data);
  };

  if (!eventId || !user) {
    return (
      <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
        <View style={stylesheet.noPermBox}>
          <Ionicons name="calendar-outline" size={42} color={theme.colors.G} />
          <Text style={[stylesheet.noPermText, { color: theme.colors.TEXT_PRIMARY }]}>
            Choose an event to check in guests
          </Text>
          <Text style={stylesheet.helper}>
            Open an event you organize so each ticket is checked against the right guest list.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.replace('/my-events')}
            style={[stylesheet.permBtn, { backgroundColor: theme.colors.G }]}
          >
            <Text style={stylesheet.permBtnText}>Go to my events</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      {/* Header */}
      <View style={[stylesheet.header, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>Guest check-in</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={stylesheet.content} keyboardShouldPersistTaps="handled">
        <Text style={stylesheet.eyebrow}>WELCOME THEM IN</Text>
        <Text style={stylesheet.introTitle}>One ticket. One entry.</Text>
        <Text style={stylesheet.helper}>
          Scan a guest’s QR code or enter their full ticket code below.
        </Text>
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
              onPress={() =>
                permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()
              }
            >
              <Text style={stylesheet.permBtnText}>
                {permission?.canAskAgain === false ? 'Open settings' : 'Enable camera'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan Result Alert Banner */}
        {lastResult && (
          <View
            style={[
              stylesheet.resultCard,
              {
                backgroundColor: lastResult.success ? theme.colors.G + '18' : theme.colors.SURFACE,
                borderWidth: 1,
                borderColor: lastResult.success ? theme.colors.G : '#D96666',
              },
            ]}
          >
            <Ionicons
              name={lastResult.success ? 'checkmark-circle' : 'alert-circle'}
              size={32}
              color={theme.colors.TEXT_PRIMARY}
            />
            <View style={{ flex: 1 }}>
              <Text style={stylesheet.resultTitle}>
                {lastResult.success ? 'Guest checked in' : 'Check-in not completed'}
              </Text>
              <Text style={stylesheet.resultBody}>{lastResult.message}</Text>
            </View>
            {!verifying && (
              <TouchableOpacity
                style={stylesheet.rescanBtn}
                onPress={() => {
                  setScanned(false);
                  setLastResult(null);
                  setManualCode('');
                }}
              >
                <Text style={stylesheet.rescanBtnText}>Next guest</Text>
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
            Enter ticket code
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
              accessibilityLabel="Full ticket code"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[stylesheet.verifyBtn, { backgroundColor: theme.colors.G }]}
              onPress={() => verifyTicketCode(manualCode)}
              disabled={verifying || !manualCode.trim()}
            >
              {verifying ? (
                <ActivityIndicator color={theme.colors.DARK} size="small" />
              ) : (
                <Text style={stylesheet.verifyBtnText}>Check</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontFamily: 'Outfit-Bold' },
  eyebrow: { fontFamily: 'Inter-Bold', color: theme.colors.G, fontSize: 11, letterSpacing: 1.8 },
  introTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.TEXT_PRIMARY,
  },
  helper: { fontFamily: 'Inter-Regular', color: theme.colors.MUTED, fontSize: 14, lineHeight: 21 },
  content: { flexGrow: 1, padding: 20, gap: 16 },
  cameraFrame: {
    height: 280,
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
    color: '#FFFFFF',
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
  resultBody: { color: theme.colors.TEXT_PRIMARY, fontSize: 13, marginTop: 2 },
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
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  verifyBtn: {
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
}));
