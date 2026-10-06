import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../../hooks/use-supabase-auth';
import { DisputeData, DisputeService } from '../../lib/dispute-service';
import ImagePicker from 'react-native-image-crop-picker';
import { StorageService } from '../../lib/storage-service';

export default function CustomerDisputeDetailScreen() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [dispute, setDispute] = useState<DisputeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidencePath, setEvidencePath] = useState('');
  const [evidencePreview, setEvidencePreview] = useState('');
  const [savingEvidence, setSavingEvidence] = useState(false);

  const chooseEvidence = async () => {
    if (!user || !dispute?.transaction?.id) return;
    try {
      const image = await ImagePicker.openPicker({ mediaType: 'photo', cropping: true, compressImageQuality: 0.9 });
      if (image.size > 10 * 1024 * 1024) return Alert.alert('File too large', 'Evidence files must be 10 MB or smaller.');
      const ext = image.path.split('.').pop()?.split('?')[0] || 'jpg';
      const mime = image.mime || (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');
      const { path, error: uploadError } = await StorageService.uploadDisputeEvidence(dispute.transaction.id, user.id, {
        uri: image.path, name: `evidence_${Date.now()}.${ext}`, type: mime, size: image.size,
      });
      if (uploadError || !path) throw uploadError || new Error('Evidence upload failed.');
      setEvidencePath(path);
      setEvidencePreview(image.path);
    } catch (e) {
      if (!(e instanceof Error && e.message.toLowerCase().includes('cancel'))) {
        Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload evidence.');
      }
    }
  };

  const submitEvidence = async () => {
    if (!id || !user || (!evidenceDescription.trim() && !evidencePath)) return;
    setSavingEvidence(true);
    try {
      await DisputeService.submitEvidence(id, user.id, {
        description: evidenceDescription.trim() || undefined,
        photos: evidencePath ? [evidencePath] : [],
      });
      setEvidenceDescription('');
      setEvidencePath('');
      setEvidencePreview('');
      await load();
      Alert.alert('Evidence submitted', 'Your evidence has been added to the dispute.');
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingEvidence(false);
    }
  };

  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const result = await DisputeService.getDisputeDetails(id);
      setDispute(result);
      setError(result ? '' : 'Dispute not found.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this dispute.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);

  const evidence = dispute?.transaction?.buyer_id === user?.id
    ? dispute?.buyerEvidence || dispute?.buyer_evidence
    : dispute?.sellerEvidence || dispute?.seller_evidence;
  const panel = { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.GLASS_BORDER }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={26} color={theme.colors.TEXT_PRIMARY} /></TouchableOpacity>
        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 19, fontWeight: '700', marginLeft: 14 }}>Dispute details</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.G} /> : error || !dispute ? <Text style={{ color: theme.colors.LABEL, textAlign: 'center', margin: 24 }}>{error || 'Dispute not found.'}</Text> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={panel}>
            <Text style={{ color: theme.colors.G, fontWeight: '700' }}>{dispute.status.replace('_', ' ').toUpperCase()}</Text>
            <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginTop: 10 }}>{dispute.transaction?.item?.title || 'Transaction dispute'}</Text>
            <Text style={{ color: theme.colors.LABEL, marginTop: 10 }}>Reason: {(dispute.disputeReason || dispute.dispute_reason || 'Dispute').replace(/_/g, ' ')}</Text>
            <Text style={{ color: theme.colors.MUTED, marginTop: 6 }}>Opened {dispute.createdAt ? new Date(dispute.createdAt).toLocaleString() : ''}</Text>
            <Text style={{ color: theme.colors.TEXT_PRIMARY, marginTop: 14 }}>{evidence?.description || 'No additional description submitted.'}</Text>
          </View>
          {(evidence?.photos?.length || 0) > 0 && <View style={panel}>
            <Text style={{ color: theme.colors.MUTED, fontWeight: '700', marginBottom: 12 }}>YOUR EVIDENCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {evidence?.photos?.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={{ width: 112, height: 112, borderRadius: 10, backgroundColor: theme.colors.DARK }} contentFit="cover" />)}
            </ScrollView>
          </View>}
          {['open', 'under_review'].includes(dispute.status) && <View style={panel}>
            <Text style={{ color: theme.colors.MUTED, fontWeight: '700', marginBottom: 12 }}>ADD EVIDENCE</Text>
            <TextInput
              value={evidenceDescription}
              onChangeText={setEvidenceDescription}
              placeholder="Add context for your evidence (optional)"
              placeholderTextColor={theme.colors.MUTED}
              multiline
              maxLength={4000}
              style={{ minHeight: 84, color: theme.colors.TEXT_PRIMARY, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 10, padding: 12, textAlignVertical: 'top' }}
            />
            {evidencePreview ? <Image source={{ uri: evidencePreview }} style={{ width: 96, height: 96, borderRadius: 10, marginTop: 12 }} contentFit="cover" /> : null}
            <TouchableOpacity onPress={chooseEvidence} style={{ paddingVertical: 12 }}><Text style={{ color: theme.colors.G, fontWeight: '700' }}>{evidencePath ? 'Replace photo' : 'Add a photo'}</Text></TouchableOpacity>
            <TouchableOpacity disabled={savingEvidence || (!evidenceDescription.trim() && !evidencePath)} onPress={submitEvidence} style={{ backgroundColor: theme.colors.G, borderRadius: 10, padding: 14, alignItems: 'center', opacity: savingEvidence ? 0.6 : 1 }}>
              <Text style={{ color: theme.colors.DARK, fontWeight: '700' }}>{savingEvidence ? 'Submitting…' : 'Submit evidence'}</Text>
            </TouchableOpacity>
          </View>}
          {dispute.status === 'resolved' && <View style={panel}>
            <Text style={{ color: theme.colors.MUTED, fontWeight: '700' }}>RESOLUTION</Text>
            <Text style={{ color: theme.colors.TEXT_PRIMARY, marginTop: 10 }}>{dispute.resolution || 'Resolved'}</Text>
            <Text style={{ color: theme.colors.LABEL, marginTop: 8 }}>Refund: ₦{Number(dispute.refundAmount ?? dispute.refund_amount ?? 0).toLocaleString()}</Text>
          </View>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
