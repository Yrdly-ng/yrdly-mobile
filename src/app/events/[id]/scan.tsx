import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Vibration, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';

const RED = '#B71C1C';

type ScanResult = { success: true; attendee: string } | { success: false; message: string } | null;

export default function ScanTicketScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<ScanResult>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const cooldownRef = useRef(false);

  const showFlash = (success: boolean) => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(success ? [0, 100] : [0, 200, 100, 200]);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setScanning(false);

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      // Fallback if data is just the ticket ID
      parsedData = { ticket_code: data };
    }

    const ticketCode = parsedData.ticket_code;

    try {
      // Secure server-side check-in via backend API (validates organizer ownership & ticket state)
      const res = await api.post<any>('/api/events/checkin', {
        ticket_code: ticketCode,
        event_id: id,
      });

      if (res?.valid) {
        setResult({ success: true, attendee: res.attendee_name || 'Attendee' });
        showFlash(true);
      } else {
        setResult({
          success: false,
          message: res?.message || res?.error || 'Check-in failed.',
        });
        showFlash(false);
      }
    } catch (e: any) {
      const errMsg =
        e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Check-in failed.';
      setResult({ success: false, message: errMsg });
      showFlash(false);
    }

    // Allow next scan after 2.5 seconds
    setTimeout(() => {
      setResult(null);
      setScanning(true);
      cooldownRef.current = false;
    }, 2500);
  };

  if (!permission) {
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <Text style={{ color: theme.colors.TEXT_PRIMARY }}>Requesting camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[stylesheet.center, { backgroundColor: theme.colors.DARK }]}>
        <Feather name="camera" size={60} color={theme.colors.MUTED} />
        <Text style={[stylesheet.permText, { color: theme.colors.LABEL }]}>
          Camera access is required to scan tickets.
        </Text>
        <TouchableOpacity
          style={[stylesheet.permBtn, { backgroundColor: theme.colors.G }]}
          onPress={requestPermission}
        >
          <Text style={[stylesheet.permBtnText, { color: '#000' }]}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const flashBg = result?.success ? theme.colors.G : RED;

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <CameraView
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        facing="back"
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Flash overlay */}
      <Animated.View
        style={[stylesheet.flashOverlay, { backgroundColor: flashBg, opacity: flashAnim }]}
        pointerEvents="none"
      />

      {/* Header overlay */}
      <SafeAreaView style={stylesheet.headerOverlay}>
        <View style={stylesheet.header}>
          <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
            <Feather name="x" size={28} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Scan Ticket
          </Text>
          <View style={{ width: 48 }} />
        </View>
      </SafeAreaView>

      {/* Viewfinder */}
      <View style={stylesheet.viewfinderContainer}>
        <View style={stylesheet.viewfinder}>
          <View style={[stylesheet.corner, stylesheet.topLeft]} />
          <View style={[stylesheet.corner, stylesheet.topRight]} />
          <View style={[stylesheet.corner, stylesheet.bottomLeft]} />
          <View style={[stylesheet.corner, stylesheet.bottomRight]} />
        </View>
        <Text style={stylesheet.scanHint}>
          Point camera at the QR code on the attendee's ticket
        </Text>
      </View>

      {/* Result overlay */}
      {result && (
        <View
          style={[
            stylesheet.resultBanner,
            {
              backgroundColor: result.success ? theme.colors.SURFACE : '#FFEBEE',
              shadowColor: theme.colors.TEXT_PRIMARY,
            },
          ]}
        >
          <Feather
            name={result.success ? 'check-circle' : 'x-circle'}
            size={36}
            color={result.success ? theme.colors.G : RED}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[stylesheet.resultTitle, { color: result.success ? theme.colors.G : RED }]}
            >
              {result.success ? '✓ Valid Ticket' : '✗ Invalid Ticket'}
            </Text>
            <Text style={[stylesheet.resultSub, { color: theme.colors.LABEL }]}>
              {result.success ? result.attendee : result.message}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  permText: { fontSize: 15, textAlign: 'center' },
  permBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
  permBtnText: { fontSize: 16, fontWeight: 'bold' },
  flashOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.TEXT_PRIMARY,
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  viewfinder: {
    width: 240,
    height: 240,
    position: 'relative',
    marginBottom: 24,
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: theme.colors.TEXT_PRIMARY,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: theme.colors.TEXT_PRIMARY,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: theme.colors.TEXT_PRIMARY,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: theme.colors.TEXT_PRIMARY,
    borderBottomRightRadius: 4,
  },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  resultBanner: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  resultTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  resultSub: { fontSize: 14 },
}));
