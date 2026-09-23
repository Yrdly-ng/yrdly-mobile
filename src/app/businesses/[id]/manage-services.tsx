import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useServiceOfferings } from '../../../hooks/use-bookings';
import { BookingService } from '../../../lib/booking-service';

export default function ManageServicesScreen() {
  const { styles: s, theme } = useStyles(stylesheet);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { offerings, loading, refresh } = useServiceOfferings(id);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [price, setPrice] = useState('');
  const [priceIsFrom, setPriceIsFrom] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setDurationMinutes('60');
    setPrice('');
    setPriceIsFrom(false);
    setModalVisible(true);
  };

  const openEditModal = (offering: any) => {
    setEditingId(offering.id);
    setName(offering.name);
    setDescription(offering.description || '');
    setDurationMinutes(String(offering.duration_minutes));
    setPrice(offering.price ? String(offering.price) : '');
    setPriceIsFrom(offering.price_is_from || false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Service name is required');
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) return Alert.alert('Error', 'Valid duration in minutes is required');

    setSaving(true);
    try {
      const parsedPrice = price.trim() ? parseFloat(price) : undefined;
      if (editingId) {
        await BookingService.updateServiceOffering(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          duration_minutes: duration,
          price: parsedPrice,
          price_is_from: priceIsFrom,
        });
      } else {
        await BookingService.createServiceOffering({
          business_id: id!,
          name: name.trim(),
          description: description.trim() || undefined,
          duration_minutes: duration,
          price: parsedPrice,
          price_is_from: priceIsFrom,
          is_active: true,
        });
      }
      setModalVisible(false);
      refresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save service offering');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (offeringId: string) => {
    Alert.alert('Delete Service', 'Are you sure you want to remove this service?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await BookingService.deleteServiceOffering(offeringId);
            refresh();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manage Services</Text>
        <TouchableOpacity style={s.addBtnHeader} onPress={openAddModal}>
          <Ionicons name="add" size={24} color={theme.colors.G} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {offerings.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="cut-outline" size={48} color={theme.colors.LABEL} />
              <Text style={s.emptyText}>No service offerings added yet</Text>
              <TouchableOpacity style={s.addBtn} onPress={openAddModal}>
                <Text style={s.addBtnText}>+ Add First Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            offerings.map((item) => (
              <View key={item.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>{item.name}</Text>
                  <View style={s.actionRow}>
                    <TouchableOpacity onPress={() => openEditModal(item)} style={s.iconBtn}>
                      <Ionicons name="pencil" size={18} color={theme.colors.LABEL} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>

                {!!item.description && <Text style={s.cardDesc}>{item.description}</Text>}

                <View style={s.metaRow}>
                  <View style={s.tag}>
                    <Ionicons name="time-outline" size={14} color={theme.colors.LABEL} />
                    <Text style={s.tagText}>{item.duration_minutes} mins</Text>
                  </View>

                  {item.price !== undefined && item.price !== null && (
                    <View style={s.tag}>
                      <Text style={s.priceText}>
                        {item.price_is_from ? 'From ' : ''}₦{item.price.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{editingId ? 'Edit Service' : 'Add Service'}</Text>

            <Text style={s.label}>Service Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Haircut & Styling"
              placeholderTextColor={theme.colors.LABEL}
              value={name}
              onChangeText={setName}
            />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.multiline]}
              placeholder="Details about what's included..."
              placeholderTextColor={theme.colors.LABEL}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={s.label}>Duration (minutes) *</Text>
            <TextInput
              style={s.input}
              placeholder="60"
              placeholderTextColor={theme.colors.LABEL}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="number-pad"
            />

            <Text style={s.label}>Price (₦)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 5000"
              placeholderTextColor={theme.colors.LABEL}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={s.checkboxRow}
              onPress={() => setPriceIsFrom(!priceIsFrom)}
            >
              <Ionicons
                name={priceIsFrom ? 'checkbox' : 'square-outline'}
                size={20}
                color={theme.colors.G}
              />
              <Text style={s.checkboxLabel}>Price is a "Starting from" estimate</Text>
            </TouchableOpacity>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={s.saveBtnText}>Save Service</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
  },
  addBtnHeader: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  emptyBox: {
    alignItems: 'center',
    justify: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.LABEL,
    marginVertical: 12,
  },
  addBtn: {
    backgroundColor: theme.colors.G,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 4 },
  cardDesc: {
    fontSize: 14,
    color: theme.colors.LABEL,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.DARK,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: theme.colors.LABEL },
  priceText: { fontSize: 13, fontWeight: '700', color: theme.colors.G },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.DARK,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  checkboxLabel: { fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  cancelBtnText: { color: theme.colors.TEXT_PRIMARY, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.G,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  saveBtnText: { color: '#000', fontWeight: '600' },
}));
