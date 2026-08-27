import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';

export function LocationChip() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { displayLabel, activeFilter, setGlobalFilter, userProfileLocation, hasLocation } =
    useLocation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (type: 'all' | 'state' | 'lga') => {
    if (!hasLocation || !userProfileLocation) {
      setModalVisible(false);
      return;
    }

    if (type === 'all') {
      setGlobalFilter(null);
    } else if (type === 'state') {
      setGlobalFilter({ state: userProfileLocation.state });
    } else if (type === 'lga') {
      setGlobalFilter({ state: userProfileLocation.state, lga: userProfileLocation.lga });
    }
    setModalVisible(false);
  };

  const currentType = !activeFilter ? 'all' : activeFilter.lga ? 'lga' : 'state';

  return (
    <>
      <TouchableOpacity
        style={[
          stylesheet.chip,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="location-sharp" size={14} color={theme.colors.G} />
        <Text style={[stylesheet.chipText, { color: theme.colors.TEXT_PRIMARY }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <Feather name="chevron-down" size={14} color={theme.colors.TEXT_SECONDARY} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={stylesheet.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={[stylesheet.modalContent, { backgroundColor: theme.colors.DARK }]}>
          <Text style={[stylesheet.modalTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            View Area
          </Text>

          <TouchableOpacity
            style={[stylesheet.modalOption, { borderBottomColor: theme.colors.GLASS_BORDER }]}
            onPress={() => handleSelect('all')}
          >
            <Text style={[stylesheet.modalOptionText, { color: theme.colors.TEXT_PRIMARY }]}>
              All Nigeria
            </Text>
            {currentType === 'all' && <Feather name="check" size={20} color={theme.colors.G} />}
          </TouchableOpacity>

          {hasLocation && userProfileLocation?.state && (
            <TouchableOpacity
              style={[stylesheet.modalOption, { borderBottomColor: theme.colors.GLASS_BORDER }]}
              onPress={() => handleSelect('state')}
            >
              <Text style={[stylesheet.modalOptionText, { color: theme.colors.TEXT_PRIMARY }]}>
                {userProfileLocation.state} State
              </Text>
              {currentType === 'state' && <Feather name="check" size={20} color={theme.colors.G} />}
            </TouchableOpacity>
          )}

          {hasLocation && userProfileLocation?.lga && (
            <TouchableOpacity
              style={[stylesheet.modalOption, { borderBottomColor: theme.colors.GLASS_BORDER }]}
              onPress={() => handleSelect('lga')}
            >
              <Text style={[stylesheet.modalOptionText, { color: theme.colors.TEXT_PRIMARY }]}>
                {userProfileLocation.lga}
              </Text>
              {currentType === 'lga' && <Feather name="check" size={20} color={theme.colors.G} />}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[stylesheet.closeModalButton, { backgroundColor: theme.colors.SURFACE_ALT }]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={[stylesheet.closeModalButtonText, { color: theme.colors.TEXT_PRIMARY }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    maxWidth: 160,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeModalButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
