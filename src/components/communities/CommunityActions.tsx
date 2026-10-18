import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';

export type CommunityActionOption = { label: string; destructive?: boolean; run: () => void };
export function CommunityActions({
  title,
  options,
  onClose,
}: {
  title: string;
  options: CommunityActionOption[];
  onClose: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close actions"
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: theme.colors.DARK,
            padding: 20,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '80%',
          }}
        >
          <Text
            style={{
              color: theme.colors.TEXT_PRIMARY,
              fontSize: 20,
              fontFamily: 'Inter-Bold',
              marginBottom: 12,
            }}
          >
            {title}
          </Text>
          <ScrollView>
            {options.map((option) => (
              <TouchableOpacity
                key={option.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  option.run();
                }}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                }}
              >
                <Text
                  style={{
                    color: option.destructive ? '#ef4444' : theme.colors.TEXT_PRIMARY,
                    fontSize: 16,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 18 }}>
            <Text style={{ color: theme.colors.G, textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
