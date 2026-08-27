import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface DateTimePickerModalProps {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  title?: string;
}

const G = '#2dd4bf';

export function DateTimePickerModal({
  visible,
  mode,
  value,
  onConfirm,
  onCancel,
  title,
}: DateTimePickerModalProps) {
  const [tempDate, setTempDate] = useState(value);

  // Android opens its own modal
  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            onConfirm(selectedDate);
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  // iOS requires a wrapper modal to present the spinner nicely
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.btn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {title || (mode === 'date' ? 'Select Date' : 'Select Time')}
            </Text>
            <TouchableOpacity onPress={() => onConfirm(tempDate)} style={styles.btn}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="spinner"
              textColor="#ffffff"
              onChange={(event, selectedDate) => {
                if (selectedDate) setTempDate(selectedDate);
              }}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40, // safe area padding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    padding: 8,
  },
  cancelText: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  confirmText: {
    color: G,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  pickerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
