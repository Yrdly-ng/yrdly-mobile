import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function OpeningHoursPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const [visible, setVisible] = useState(false);
  const [startDay, setStartDay] = useState('Mon');
  const [endDay, setEndDay] = useState('Sat');

  const [openTime, setOpenTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showOpenPicker, setShowOpenPicker] = useState(false);

  const [closeTime, setCloseTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [showClosePicker, setShowClosePicker] = useState(false);

  // Try to parse existing value roughly
  React.useEffect(() => {
    if (value && value.includes('-')) {
      // Just a rough parsing logic for UI init, could be more robust
      const parts = value.split(':');
      if (parts.length > 1) {
        const daysStr = parts[0].trim();
        const daysSplit = daysStr.split('-');
        if (daysSplit.length === 2) {
          setStartDay(daysSplit[0].trim());
          setEndDay(daysSplit[1].trim());
        }
      }
    }
  }, [value]);

  const handleSave = () => {
    const openStr = openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const closeStr = closeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    onChange(`${startDay}-${endDay}: ${openStr} - ${closeStr}`);
    setVisible(false);
  };

  const handleClear = () => {
    onChange('');
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity style={stylesheet.pickerBox} onPress={() => setVisible(true)}>
        <Text style={{ color: value ? '#fff' : theme.colors.MUTED, fontSize: 15 }}>
          {value || 'Select Opening Hours'}
        </Text>
        <Ionicons name="time-outline" size={20} color={theme.colors.MUTED} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={stylesheet.modalOverlay}>
          <View style={stylesheet.modalContent}>
            <View style={stylesheet.modalHeader}>
              <Text style={stylesheet.modalTitle}>Opening Hours</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={stylesheet.section}>
              <Text style={stylesheet.label}>Working Days</Text>
              <View style={stylesheet.row}>
                <View style={stylesheet.pickerCol}>
                  <Text style={stylesheet.sublabel}>From</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={stylesheet.dayScroll}
                  >
                    {DAYS.map((d) => {
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[stylesheet.dayBtn, startDay === d && stylesheet.dayBtnActive]}
                          onPress={() => setStartDay(d)}
                        >
                          <Text
                            style={[stylesheet.dayTxt, startDay === d && stylesheet.dayTxtActive]}
                          >
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
              <View style={[stylesheet.row, { marginTop: 12 }]}>
                <View style={stylesheet.pickerCol}>
                  <Text style={stylesheet.sublabel}>To</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={stylesheet.dayScroll}
                  >
                    {DAYS.map((d) => {
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[stylesheet.dayBtn, endDay === d && stylesheet.dayBtnActive]}
                          onPress={() => setEndDay(d)}
                        >
                          <Text
                            style={[stylesheet.dayTxt, endDay === d && stylesheet.dayTxtActive]}
                          >
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={stylesheet.section}>
              <Text style={stylesheet.label}>Business Hours</Text>
              <View style={stylesheet.timeWrap}>
                <View style={stylesheet.timeBox}>
                  <Text style={stylesheet.sublabel}>Opens</Text>
                  <TouchableOpacity
                    style={stylesheet.timeBtnWrapper}
                    onPress={() => setShowOpenPicker(true)}
                  >
                    <Text style={stylesheet.timeBtnText}>
                      {openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showOpenPicker && (
                    <DateTimePicker
                      value={openTime}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        setShowOpenPicker(false);
                        if (selectedTime) setOpenTime(selectedTime);
                      }}
                    />
                  )}
                </View>
                <View style={stylesheet.timeBox}>
                  <Text style={stylesheet.sublabel}>Closes</Text>
                  <TouchableOpacity
                    style={stylesheet.timeBtnWrapper}
                    onPress={() => setShowClosePicker(true)}
                  >
                    <Text style={stylesheet.timeBtnText}>
                      {closeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showClosePicker && (
                    <DateTimePicker
                      value={closeTime}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        setShowClosePicker(false);
                        if (selectedTime) setCloseTime(selectedTime);
                      }}
                    />
                  )}
                </View>
              </View>
            </View>

            <View style={stylesheet.btnRow}>
              <TouchableOpacity style={stylesheet.clearBtn} onPress={handleClear}>
                <Text style={stylesheet.clearBtnTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={stylesheet.saveBtn} onPress={handleSave}>
                <Text style={stylesheet.saveBtnTxt}>Save Hours</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  pickerBox: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: theme.colors.TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  section: { marginBottom: 24 },
  label: { color: theme.colors.LABEL, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pickerCol: { flex: 1 },
  sublabel: {
    color: theme.colors.MUTED,
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dayScroll: { flexGrow: 0 },
  dayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.SURFACE,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  dayBtnActive: { backgroundColor: 'rgba(130,219,126,0.15)', borderColor: theme.colors.G },
  dayTxt: { color: theme.colors.MUTED, fontSize: 13 },
  dayTxtActive: { color: theme.colors.G, fontWeight: '600' },
  timeWrap: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  timeBox: { flex: 1 },
  timeBtnWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
  },
  timeBtnText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    alignItems: 'center',
  },
  clearBtnTxt: { color: theme.colors.TEXT_PRIMARY, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
  },
  saveBtnTxt: { color: '#000', fontWeight: '600', fontSize: 15 },
}));
