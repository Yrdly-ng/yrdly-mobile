import { businessScreenStyles as businessUI } from '../../../components/businesses/business-screen-styles';
import { isPaidPrice, MINIMUM_PRICE_MESSAGE } from '@/lib/marketplace/price-policy';
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
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useServiceOfferings } from '../../../hooks/bookings/use-bookings';
import { BookingService } from '../../../lib/bookings/booking-service';

export default function ManageServicesScreen() {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { offerings, loading, error, refresh } = useServiceOfferings(id);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [price, setPrice] = useState('');
  const [priceIsFrom, setPriceIsFrom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [fullPayment, setFullPayment] = useState(false);
  const [escrowEnabled, setEscrowEnabled] = useState(false);

  const openAddModal = () => {
    setEditingId(null);
    setDepositRequired(false);
    setDepositAmount('');
    setDepositPercent('');
    setFullPayment(false);
    setEscrowEnabled(false);
    setName('');
    setDescription('');
    setDurationMinutes('60');
    setPrice('');
    setPriceIsFrom(false);
    setModalVisible(true);
  };

  const openEditModal = (offering: any) => {
    setEditingId(offering.id);
    setDepositRequired(!!offering.deposit_required);
    setDepositAmount(offering.deposit_amount == null ? '' : String(offering.deposit_amount));
    setDepositPercent(offering.deposit_percent == null ? '' : String(offering.deposit_percent));
    setFullPayment(!!offering.requires_full_payment);
    setEscrowEnabled(!!offering.escrow_enabled);
    setName(offering.name);
    setDescription(offering.description || '');
    setDurationMinutes(String(offering.duration_minutes));
    setPrice(offering.price !== null && offering.price !== undefined ? String(offering.price) : '');
    setPriceIsFrom(offering.price_is_from || false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Service name is required');
    const duration = Number(durationMinutes);
    if (!Number.isSafeInteger(duration) || duration <= 0)
      return Alert.alert('Error', 'Valid duration in minutes is required');

    if (price.trim() && !isPaidPrice(Number(price), true))
      return Alert.alert('Invalid price', MINIMUM_PRICE_MESSAGE);

    if (depositRequired && !fullPayment && !escrowEnabled) {
      const amount = Number(depositAmount),
        percent = Number(depositPercent);
      if (
        !!depositAmount.trim() === !!depositPercent.trim() ||
        (depositAmount.trim() &&
          (!Number.isFinite(amount) || amount <= 0 || (price.trim() && amount > Number(price)))) ||
        (depositPercent.trim() && (!Number.isFinite(percent) || percent <= 0 || percent > 100))
      ) {
        return Alert.alert(
          'Invalid deposit',
          'Enter either a positive deposit amount up to the service price, or a percentage from 1 to 100.'
        );
      }
    }
    const paymentSettings = {
      deposit_required: depositRequired,
      deposit_amount: depositAmount.trim() ? Number(depositAmount) : null,
      deposit_percent: depositPercent.trim() ? Number(depositPercent) : null,
      requires_full_payment: fullPayment,
      escrow_enabled: escrowEnabled,
    };
    setSaving(true);
    try {
      const parsedPrice = price.trim() ? parseFloat(price) : undefined;
      if (editingId) {
        await BookingService.updateServiceOffering(editingId, {
          ...paymentSettings,
          name: name.trim(),
          description: description.trim() || undefined,
          duration_minutes: duration,
          price: parsedPrice,
          price_is_from: priceIsFrom,
        });
      } else {
        await BookingService.createServiceOffering({
          business_id: id!,
          ...paymentSettings,
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
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Services</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add service"
          style={s.addBtnHeader}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color={theme.colors.G} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={businessUI.section}>
            <Text style={businessUI.eyebrow}>YOUR SERVICE MENU</Text>
            <Text style={businessUI.title}>What can you help with?</Text>
            <Text style={businessUI.subtitle}>
              Clear names, prices and durations make it easier for customers to book.
            </Text>
          </View>
          {error && (
            <View style={businessUI.notice}>
              <Text style={businessUI.noticeText}>{error}</Text>
              <TouchableOpacity style={businessUI.secondaryButton} onPress={refresh}>
                <Text style={businessUI.secondaryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
          {offerings.length === 0 && !error ? (
            <View style={s.emptyBox}>
              <Ionicons name="cut-outline" size={48} color={theme.colors.LABEL} />
              <Text style={s.emptyText}>Your first booking starts here.</Text>
              <TouchableOpacity style={s.addBtn} onPress={openAddModal}>
                <Text style={s.addBtnText}>Add your first service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            offerings.map((item) => (
              <View key={item.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>{item.name}</Text>
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.name}`}
                      onPress={() => openEditModal(item)}
                      style={s.iconBtn}
                    >
                      <Ionicons name="pencil" size={18} color={theme.colors.LABEL} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.name}`}
                      onPress={() => handleDelete(item.id)}
                      style={s.iconBtn}
                    >
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
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={s.modalContent}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
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

            <Text style={s.label}>Price (₦) · optional</Text>
            <Text style={businessUI.muted}>
              Leave blank if the price is agreed with the customer.
            </Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 5000"
              placeholderTextColor={theme.colors.LABEL}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: priceIsFrom }}
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

            <Text style={s.label}>Booking payment</Text>
            <Text style={businessUI.muted}>
              Deposits charge only the deposit. Full payment collects the agreed total. Escrow holds
              payment until release.
            </Text>
            {[
              { label: 'Require a deposit', value: depositRequired, set: setDepositRequired },
              { label: 'Require full payment', value: fullPayment, set: setFullPayment },
              { label: 'Hold payment in escrow', value: escrowEnabled, set: setEscrowEnabled },
            ].map((option) => (
              <TouchableOpacity
                key={option.label}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: option.value }}
                style={s.checkboxRow}
                onPress={() => option.set(!option.value)}
              >
                <Ionicons
                  name={option.value ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={theme.colors.G}
                />
                <Text style={s.checkboxLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            {depositRequired && (
              <>
                <TextInput
                  accessibilityLabel="Deposit amount"
                  style={s.input}
                  placeholder="Deposit amount (₦)"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="decimal-pad"
                  value={depositAmount}
                  onChangeText={(value) => {
                    setDepositAmount(value);
                    setDepositPercent('');
                  }}
                />
                <TextInput
                  accessibilityLabel="Deposit percent"
                  style={s.input}
                  placeholder="Or deposit percentage"
                  placeholderTextColor={theme.colors.LABEL}
                  keyboardType="decimal-pad"
                  value={depositPercent}
                  onChangeText={(value) => {
                    setDepositPercent(value);
                    setDepositAmount('');
                  }}
                />
              </>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={s.saveBtnText}>Save Service</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const stylesheet = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.SURFACE,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
  },
  addBtnHeader: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 48 },
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
    borderRadius: 14,
  },
  addBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: theme.colors.SURFACE,
    padding: 16,
    borderRadius: 22,
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
    fontFamily: 'Outfit-Bold',
    fontSize: 21,
    fontWeight: '700',
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  actionRow: { flexDirection: 'row', gap: 2 },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cardDesc: {
    fontSize: 14,
    color: theme.colors.LABEL,
    marginTop: 6,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 26,
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
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 14,
  },
  checkboxLabel: { flex: 1, fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  cancelBtnText: { color: theme.colors.TEXT_PRIMARY, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.G,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    borderRadius: 14,
  },
  saveBtnText: { color: '#000', fontWeight: '600' },
}));
