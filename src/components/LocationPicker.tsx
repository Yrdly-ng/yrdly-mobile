import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  detectLocation,
  getAllStates,
  getLgasForState,
  OUTSIDE_NIGERIA,
  PERMISSION_DENIED,
  ResolvedLocation,
} from '../lib/geocoding-service';

export interface LocationValue {
  state: string;
  lga: string;
  displayAddress?: string;
  lat?: number;
  lng?: number;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (loc: LocationValue) => void;
}

type PickerMode = 'state' | 'lga';

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<'success' | 'outside' | 'denied' | null>(
    null
  );

  // Modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('state');
  const [search, setSearch] = useState('');

  const allStates = getAllStates();
  const lgas = value.state ? getLgasForState(value.state) : [];

  const handleAutoDetect = useCallback(async () => {
    setDetecting(true);
    setDetectionResult(null);
    try {
      const result = await detectLocation();
      if ('status' in result) {
        setDetectionResult(result.status === PERMISSION_DENIED ? 'denied' : 'outside');
      } else {
        const loc = result as ResolvedLocation;
        onChange({
          state: loc.state,
          lga: loc.lga,
          displayAddress: loc.displayAddress,
          lat: loc.lat,
          lng: loc.lng,
        });
        setDetectionResult('success');
      }
    } catch {
      setDetectionResult('outside');
    } finally {
      setDetecting(false);
    }
  }, [onChange]);

  const openPicker = (mode: PickerMode) => {
    setPickerMode(mode);
    setSearch('');
    setPickerVisible(true);
  };

  const handleSelectState = (state: string) => {
    onChange({ state, lga: '' });
    setPickerVisible(false);
  };

  const handleSelectLga = (lga: string) => {
    onChange({ ...value, lga });
    setPickerVisible(false);
  };

  const filteredItems =
    pickerMode === 'state'
      ? allStates.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
      : lgas.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  return (
    <View>
      {/* GPS Auto-detect button */}
      <TouchableOpacity
        style={[
          stylesheet.gpsBtn,
          { borderColor: theme.colors.G },
          detecting && stylesheet.gpsBtnLoading,
        ]}
        onPress={handleAutoDetect}
        disabled={detecting}
        activeOpacity={0.8}
      >
        {detecting ? (
          <>
            <ActivityIndicator size="small" color={theme.colors.G} style={{ marginRight: 8 }} />
            <Text style={[stylesheet.gpsBtnText, { color: theme.colors.G }]}>
              Detecting your location…
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name="location-outline"
              size={18}
              color={theme.colors.G}
              style={{ marginRight: 8 }}
            />
            <Text style={[stylesheet.gpsBtnText, { color: theme.colors.G }]}>
              Auto-detect my location
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Detection result feedback */}
      {detectionResult === 'success' && (
        <View style={[stylesheet.feedback, stylesheet.feedbackSuccess]}>
          <Feather name="check-circle" size={16} color="#2E7D32" />
          <Text style={stylesheet.feedbackTextSuccess}>Location detected successfully!</Text>
        </View>
      )}
      {detectionResult === 'outside' && (
        <View style={[stylesheet.feedback, stylesheet.feedbackWarn]}>
          <Feather name="alert-circle" size={16} color="#E65100" />
          <Text style={stylesheet.feedbackTextWarn}>
            Couldn't detect a Nigerian location. Please select manually below.
          </Text>
        </View>
      )}
      {detectionResult === 'denied' && (
        <View style={[stylesheet.feedback, stylesheet.feedbackWarn]}>
          <Feather name="lock" size={16} color="#E65100" />
          <Text style={stylesheet.feedbackTextWarn}>
            Location permission denied. Please select manually below.
          </Text>
        </View>
      )}

      {/* Divider */}
      <View style={stylesheet.divider}>
        <View style={[stylesheet.dividerLine, { backgroundColor: theme.colors.GLASS_BORDER }]} />
        <Text style={[stylesheet.dividerText, { color: theme.colors.MUTED }]}>
          or select manually
        </Text>
        <View style={[stylesheet.dividerLine, { backgroundColor: theme.colors.GLASS_BORDER }]} />
      </View>

      {/* State selector */}
      <View style={stylesheet.fieldGroup}>
        <Text style={[stylesheet.label, { color: theme.colors.TEXT_PRIMARY }]}>State *</Text>
        <TouchableOpacity
          style={[
            stylesheet.selector,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            value.state ? { borderColor: theme.colors.G } : null,
          ]}
          onPress={() => openPicker('state')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              stylesheet.selectorText,
              { color: theme.colors.TEXT_PRIMARY },
              !value.state && { color: theme.colors.MUTED },
            ]}
          >
            {value.state || 'Select your state'}
          </Text>
          <Feather
            name="chevron-down"
            size={18}
            color={value.state ? theme.colors.G : theme.colors.MUTED}
          />
        </TouchableOpacity>
      </View>

      {/* LGA selector */}
      <View style={stylesheet.fieldGroup}>
        <Text style={[stylesheet.label, { color: theme.colors.TEXT_PRIMARY }]}>
          Local Government Area *
        </Text>
        <TouchableOpacity
          style={[
            stylesheet.selector,
            { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            value.lga ? { borderColor: theme.colors.G } : null,
            !value.state && stylesheet.selectorDisabled,
          ]}
          onPress={() => value.state && openPicker('lga')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              stylesheet.selectorText,
              { color: theme.colors.TEXT_PRIMARY },
              !value.lga && { color: theme.colors.MUTED },
            ]}
          >
            {value.lga || (!value.state ? 'Select state first' : 'Select your LGA')}
          </Text>
          <Feather
            name="chevron-down"
            size={18}
            color={value.lga ? theme.colors.G : theme.colors.MUTED}
          />
        </TouchableOpacity>
      </View>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[stylesheet.modal, { backgroundColor: theme.colors.DARK }]}>
          <View style={[stylesheet.modalHeader, { borderBottomColor: theme.colors.GLASS_BORDER }]}>
            <Text style={[stylesheet.modalTitle, { color: theme.colors.TEXT_PRIMARY }]}>
              {pickerMode === 'state' ? 'Select State' : 'Select LGA'}
            </Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={stylesheet.modalClose}>
              <Feather name="x" size={24} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[
              stylesheet.searchBox,
              { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
            ]}
          >
            <Feather
              name="search"
              size={18}
              color={theme.colors.MUTED}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[stylesheet.searchInput, { color: theme.colors.TEXT_PRIMARY }]}
              value={search}
              onChangeText={setSearch}
              placeholder={pickerMode === 'state' ? 'Search states…' : 'Search LGAs…'}
              placeholderTextColor={theme.colors.MUTED}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = pickerMode === 'state' ? item === value.state : item === value.lga;
              return (
                <TouchableOpacity
                  style={[stylesheet.listItem, isSelected && stylesheet.listItemSelected]}
                  onPress={() =>
                    pickerMode === 'state' ? handleSelectState(item) : handleSelectLga(item)
                  }
                >
                  <Text
                    style={[
                      stylesheet.listItemText,
                      { color: theme.colors.TEXT_PRIMARY },
                      isSelected && { color: theme.colors.G, fontWeight: '700' },
                    ]}
                  >
                    {item}
                  </Text>
                  {isSelected && <Feather name="check" size={18} color={theme.colors.G} />}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={[stylesheet.itemSep, { backgroundColor: theme.colors.GLASS_BORDER }]} />
            )}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(130, 225, 87, 0.1)',
  },
  gpsBtnLoading: { opacity: 0.7 },
  gpsBtnText: { fontSize: 15, fontWeight: '700' },

  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackSuccess: { backgroundColor: 'rgba(130, 225, 87, 0.1)' },
  feedbackWarn: { backgroundColor: 'rgba(230, 81, 0, 0.1)' },
  feedbackTextSuccess: { fontSize: 13, color: '#82E157', flex: 1, lineHeight: 18 },
  feedbackTextWarn: { fontSize: 13, color: '#E65100', flex: 1, lineHeight: 18 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, marginHorizontal: 12, fontWeight: '600' },

  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectorDisabled: { opacity: 0.5 },
  selectorText: { fontSize: 16, flex: 1 },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { padding: 4 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16 },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  listItemSelected: { backgroundColor: 'rgba(130, 225, 87, 0.1)' },
  listItemText: { fontSize: 15 },
  itemSep: { height: 1, marginLeft: 20 },
}));
